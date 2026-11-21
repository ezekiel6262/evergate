// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IBrain, ICircuits, IERC20, IOpener} from "./ITapeOut.sol";

/// @title EvergateKeeper
/// @notice Holds each vault's circuit and is the only code that can move the
///         brain wallet. There is no admin. The circuit's step() is a view, so
///         this contract is what remembers the two state bits and refuses to
///         pay until step() says the gate is open.
contract EvergateKeeper {
    uint8 internal constant ACTIVE = 0;
    uint8 internal constant ALERT = 1;
    uint8 internal constant CLAIMABLE = 2;
    uint8 internal constant RELEASED = 3;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant MAX_HEIRS = 8;
    uint256 internal constant MAX_TOKENS = 8;
    uint256 internal constant HALF_N =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    bytes32 internal constant CHECKIN_TYPEHASH = keccak256("CheckIn(uint256 vaultId,uint256 deadline)");

    struct Heir {
        address account;
        uint16 bps;
    }

    struct Plan {
        uint256 circuitId;
        uint64 interval;
        uint64 waitPeriod;
        uint8 n;
        uint8 k;
        address[3] guardians;
        Heir[] heirs;
        address[] tokens;
    }

    struct Vault {
        address owner;
        uint256 circuitId;
        uint64 lastCheckIn;
        uint64 alertAt;
        uint64 interval;
        uint64 waitPeriod;
        uint8 n;
        uint8 k;
        uint8 state;
        uint8 approvals;
    }

    ICircuits public immutable circuits;
    IOpener public immutable opener;
    bytes32 public immutable DOMAIN;

    uint256 public nextVaultId = 1;
    mapping(uint256 => Vault) public vaults;
    /// @notice Circuit id => vault id. A replaced circuit stays here, so it cannot be registered again.
    mapping(uint256 => uint256) public circuitVault;
    mapping(uint256 => Heir[]) internal _heirs;
    mapping(uint256 => address[]) internal _tokens;
    mapping(uint256 => address[3]) internal _guardians;
    uint256 private _locked = 1;

    error Fee(uint256 need, uint256 sent);
    error Pin();
    error NotOwner();
    error NotGuardian();
    error NotActive();
    error NotAlert();
    error NotClaimable();
    error Released();
    error TooLate();
    error Expired();
    error BadSig();
    error BadPlan();
    error SameCircuit();
    error CircuitUsed();
    error TokenDropped();
    error TransferFailed();
    error NoVault();
    error Locked();

    event Created(uint256 indexed vaultId, uint256 indexed circuitId, address indexed owner);
    event CheckedIn(uint256 indexed vaultId);
    event Approved(uint256 indexed vaultId, address indexed guardian, uint8 approvals);
    event Advanced(uint256 indexed vaultId, uint8 state, bool alert, bool release);
    event Claimed(uint256 indexed vaultId);
    event Withdrawn(uint256 indexed vaultId, address token, address to, uint256 amount);
    event PlanReplaced(uint256 indexed vaultId, uint256 indexed oldCircuit, uint256 indexed newCircuit);

    modifier lock() {
        if (_locked == 2) revert Locked();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(ICircuits circuits_, IOpener opener_) {
        circuits = circuits_;
        opener = opener_;
        DOMAIN = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Evergate"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function heirsOf(uint256 vaultId) external view returns (Heir[] memory) {
        return _heirs[vaultId];
    }

    function tokensOf(uint256 vaultId) external view returns (address[] memory) {
        return _tokens[vaultId];
    }

    function guardiansOf(uint256 vaultId) external view returns (address[3] memory) {
        return _guardians[vaultId];
    }

    function walletOf(uint256 vaultId) external view returns (address) {
        Vault storage v = _existing(vaultId);
        return opener.accountOf(address(circuits), v.circuitId);
    }

    /// @notice What the next poke would do. `missed` is the 0..15 value the circuit sees.
    function preview(uint256 vaultId)
        external
        view
        returns (uint256 missed, bool waitElapsed, uint8 next, bool alert, bool release)
    {
        Vault storage v = _existing(vaultId);
        (missed, waitElapsed) = _signals(v);
        (next, alert, release) = _beat(v, false, false);
    }

    /// @notice Wrapper input word, least-significant bit first, in two bytes.
    ///         missed (4), ping, three guardian bits, wait, paid.
    function packInputs(uint256 missed, bool ping, uint8 approvals, bool waitElapsed, bool paid)
        public
        pure
        returns (bytes memory)
    {
        if (missed > 15) missed = 15;
        uint256 bits = (missed & 15) | (ping ? 1 << 4 : 0) | ((uint256(approvals) & 7) << 5)
            | (waitElapsed ? 1 << 8 : 0) | (paid ? 1 << 9 : 0);
        bytes memory data = new bytes(2);
        data[0] = bytes1(uint8(bits));
        data[1] = bytes1(uint8(bits >> 8));
        return data;
    }

    function hashCheckIn(uint256 vaultId, uint256 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(CHECKIN_TYPEHASH, vaultId, deadline));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN, structHash));
    }

    function create(Plan calldata plan) external payable lock returns (uint256 vaultId) {
        _checkPlan(plan);
        if (circuitVault[plan.circuitId] != 0) revert CircuitUsed();
        _pin(plan.circuitId, plan.n, plan.k);

        vaultId = nextVaultId++;
        circuitVault[plan.circuitId] = vaultId;
        Vault storage v = vaults[vaultId];
        v.owner = msg.sender;
        _apply(v, plan);
        _storePeople(vaultId, plan);

        circuits.transferFrom(msg.sender, address(this), plan.circuitId);
        _open(plan.circuitId);
        emit Created(vaultId, plan.circuitId, msg.sender);
    }

    function checkIn(uint256 vaultId) external lock {
        _checkIn(vaultId, msg.sender);
    }

    function checkInFor(uint256 vaultId, uint256 deadline, bytes calldata sig) external lock {
        if (block.timestamp > deadline) revert Expired();
        _checkIn(vaultId, _recover(vaultId, deadline, sig));
    }

    function approve(uint256 vaultId) external lock {
        Vault storage v = _existing(vaultId);
        if (v.state == RELEASED) revert Released();
        _commit(vaultId, false, false);
        if (v.state != ALERT) revert NotAlert();
        v.approvals |= _guardianBit(vaultId, msg.sender);
        emit Approved(vaultId, msg.sender, v.approvals);
        _commit(vaultId, false, false);
    }

    function poke(uint256 vaultId) external lock {
        Vault storage v = _existing(vaultId);
        if (v.state == RELEASED) revert Released();
        _commit(vaultId, false, false);
    }

    /// @param execFee Exact value attached to each brain-wallet execute. The account
    ///        rejects a short payment. This contract does not look up the fee.
    function claim(uint256 vaultId, uint256 execFee) external payable lock {
        Vault storage v = _existing(vaultId);
        if (v.state == RELEASED) revert Released();
        _commit(vaultId, false, false);
        if (v.state != CLAIMABLE) revert NotClaimable();

        address wallet = opener.accountOf(address(circuits), v.circuitId);
        Heir[] storage heirs = _heirs[vaultId];
        uint256 nativeBal = wallet.balance;
        (uint256[] memory nativeAmts, uint256 calls) = _split(nativeBal, heirs);

        address[] storage tokens = _tokens[vaultId];
        uint256[][] memory tokenAmts = new uint256[][](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            uint256 bal = _balanceOf(tokens[i], wallet);
            uint256 part;
            (tokenAmts[i], part) = _split(bal, heirs);
            calls += part;
        }
        if (msg.value != execFee * calls) revert Fee(execFee * calls, msg.value);

        for (uint256 i; i < heirs.length; i++) {
            if (nativeAmts[i] > 0) _exec(wallet, heirs[i].account, nativeAmts[i], "", execFee);
        }
        for (uint256 t; t < tokens.length; t++) {
            for (uint256 i; i < heirs.length; i++) {
                if (tokenAmts[t][i] == 0) continue;
                _exec(
                    wallet,
                    tokens[t],
                    0,
                    abi.encodeCall(IERC20.transfer, (heirs[i].account, tokenAmts[t][i])),
                    execFee
                );
            }
        }

        _commit(vaultId, false, true);
        if (v.state != RELEASED) revert Released();
        emit Claimed(vaultId);
    }

    /// @param token Address 0 withdraws the native coin. Only while the circuit is still active.
    function withdraw(uint256 vaultId, address token, address to, uint256 amount, uint256 execFee)
        external
        payable
        lock
    {
        Vault storage v = _existing(vaultId);
        if (msg.sender != v.owner) revert NotOwner();
        if (to == address(0) || amount == 0) revert BadPlan();
        _commit(vaultId, false, false);
        if (v.state != ACTIVE) revert NotActive();
        if (msg.value != execFee) revert Fee(execFee, msg.value);

        address wallet = opener.accountOf(address(circuits), v.circuitId);
        if (token == address(0)) {
            _exec(wallet, to, amount, "", execFee);
        } else {
            _exec(wallet, token, 0, abi.encodeCall(IERC20.transfer, (to, amount)), execFee);
        }
        emit Withdrawn(vaultId, token, to, amount);
    }

    /// @notice While the vault is active, point it at a new circuit and move the funds.
    ///         The old circuit stays in this contract and cannot be registered again.
    function replacePlan(uint256 vaultId, Plan calldata plan, uint256 execFee) external payable lock {
        Vault storage v = _existing(vaultId);
        if (msg.sender != v.owner) revert NotOwner();
        _commit(vaultId, false, false);
        if (v.state != ACTIVE) revert NotActive();
        _checkPlan(plan);
        if (plan.circuitId == v.circuitId) revert SameCircuit();
        if (circuitVault[plan.circuitId] != 0) revert CircuitUsed();
        _pin(plan.circuitId, plan.n, plan.k);
        _supersetOf(plan.tokens, _tokens[vaultId]);

        uint256 oldCircuit = v.circuitId;
        address oldWallet = opener.accountOf(address(circuits), oldCircuit);
        bool needOpen = !opener.isOpened(address(circuits), plan.circuitId);
        uint256 openFee = needOpen ? opener.FEE() : 0;

        circuits.transferFrom(msg.sender, address(this), plan.circuitId);
        if (needOpen) opener.open{value: openFee}(address(circuits), plan.circuitId);
        address newWallet = opener.accountOf(address(circuits), plan.circuitId);

        (uint256 nativeBal, uint256[] memory amounts, uint256 moves) = _snapshot(vaultId, oldWallet);
        if (msg.value != openFee + execFee * moves) revert Fee(openFee + execFee * moves, msg.value);
        _sendVault(vaultId, oldWallet, newWallet, nativeBal, amounts, execFee);

        circuitVault[plan.circuitId] = vaultId;
        _apply(v, plan);
        _storePeople(vaultId, plan);
        emit PlanReplaced(vaultId, oldCircuit, plan.circuitId);
    }

    function _checkIn(uint256 vaultId, address who) internal {
        Vault storage v = _existing(vaultId);
        if (who != v.owner) revert NotOwner();
        (uint8 next,,) = _beat(v, false, false);
        if (next == CLAIMABLE || next == RELEASED) revert TooLate();
        _commit(vaultId, true, false);
        v.lastCheckIn = uint64(block.timestamp);
        v.alertAt = 0;
        v.approvals = 0;
        emit CheckedIn(vaultId);
    }

    function _open(uint256 circuitId) internal {
        bool needOpen = !opener.isOpened(address(circuits), circuitId);
        uint256 openFee = needOpen ? opener.FEE() : 0;
        if (msg.value < openFee) revert Fee(openFee, msg.value);
        if (needOpen) opener.open{value: openFee}(address(circuits), circuitId);
        _refund(msg.value - openFee);
    }

    function _pin(uint256 circuitId, uint8 n, uint8 k) internal view {
        _expect(circuitId, ACTIVE, n, 0, false, false, false, ALERT, true, false);
        _expect(circuitId, ACTIVE, n - 1, 0, false, false, false, ACTIVE, false, false);
        uint8 quorum = uint8((1 << k) - 1);
        _expect(circuitId, ALERT, 0, quorum, false, true, false, CLAIMABLE, false, true);
        uint8 short = uint8((1 << (k - 1)) - 1);
        _expect(circuitId, ALERT, 0, short, false, true, false, ALERT, false, false);
    }

    function _expect(
        uint256 circuitId,
        uint8 state,
        uint256 missed,
        uint8 approvals,
        bool ping,
        bool waitElapsed,
        bool paid,
        uint8 wantState,
        bool wantAlert,
        bool wantRelease
    ) internal view {
        (uint8 next, bool alert, bool release) =
            _read(circuitId, state, missed, approvals, ping, waitElapsed, paid);
        if (next != wantState || alert != wantAlert || release != wantRelease) revert Pin();
    }

    function _commit(uint256 vaultId, bool ping, bool paid) internal {
        Vault storage v = vaults[vaultId];
        (uint8 next, bool alert, bool release) = _beat(v, ping, paid);
        v.state = next;
        if (alert && v.alertAt == 0) v.alertAt = uint64(block.timestamp);
        emit Advanced(vaultId, next, alert, release);
    }

    function _beat(Vault storage v, bool ping, bool paid)
        internal
        view
        returns (uint8 next, bool alert, bool release)
    {
        (uint256 missed, bool waitElapsed) = _signals(v);
        return _read(v.circuitId, v.state, missed, v.approvals, ping, waitElapsed, paid);
    }

    function _signals(Vault storage v) internal view returns (uint256 missed, bool waitElapsed) {
        if (block.timestamp > v.lastCheckIn) {
            missed = (block.timestamp - uint256(v.lastCheckIn)) / v.interval;
            if (missed > 15) missed = 15;
        }
        waitElapsed = v.alertAt != 0 && block.timestamp >= uint256(v.alertAt) + uint256(v.waitPeriod);
    }

    function _read(
        uint256 circuitId,
        uint8 state,
        uint256 missed,
        uint8 approvals,
        bool ping,
        bool waitElapsed,
        bool paid
    ) internal view returns (uint8 next, bool alert, bool release) {
        (bytes memory newState, bytes memory outputs) = circuits.step(
            circuitId, _oneByte(state), packInputs(missed, ping, approvals, waitElapsed, paid)
        );
        next = newState.length == 0 ? 0 : uint8(newState[0]) & 3;
        uint8 out = outputs.length == 0 ? 0 : uint8(outputs[0]);
        alert = out & 4 != 0;
        release = out & 8 != 0;
    }

    function _oneByte(uint8 value) internal pure returns (bytes memory data) {
        data = new bytes(1);
        data[0] = bytes1(value);
    }

    function _apply(Vault storage v, Plan calldata plan) internal {
        v.circuitId = plan.circuitId;
        v.interval = plan.interval;
        v.waitPeriod = plan.waitPeriod;
        v.n = plan.n;
        v.k = plan.k;
        v.state = 0;
        v.approvals = 0;
        v.alertAt = 0;
        v.lastCheckIn = uint64(block.timestamp);
    }

    function _storePeople(uint256 vaultId, Plan calldata plan) internal {
        delete _heirs[vaultId];
        for (uint256 i; i < plan.heirs.length; i++) {
            _heirs[vaultId].push(plan.heirs[i]);
        }
        delete _tokens[vaultId];
        for (uint256 i; i < plan.tokens.length; i++) {
            _tokens[vaultId].push(plan.tokens[i]);
        }
        _guardians[vaultId] = plan.guardians;
    }

    function _checkPlan(Plan calldata plan) internal pure {
        if (plan.circuitId == 0 || plan.interval < 1 || plan.waitPeriod < 1) revert BadPlan();
        if (plan.n < 1 || plan.n > 15 || plan.k < 1 || plan.k > 3) revert BadPlan();
        if (plan.heirs.length < 1 || plan.heirs.length > MAX_HEIRS) revert BadPlan();
        if (plan.tokens.length > MAX_TOKENS) revert BadPlan();
        address[3] calldata g = plan.guardians;
        if (g[0] == address(0) || g[1] == address(0) || g[2] == address(0)) revert BadPlan();
        if (g[0] == g[1] || g[0] == g[2] || g[1] == g[2]) revert BadPlan();
        uint256 sum;
        for (uint256 i; i < plan.heirs.length; i++) {
            if (plan.heirs[i].account == address(0) || plan.heirs[i].bps == 0) revert BadPlan();
            for (uint256 j; j < i; j++) {
                if (plan.heirs[j].account == plan.heirs[i].account) revert BadPlan();
            }
            sum += plan.heirs[i].bps;
        }
        if (sum != BPS) revert BadPlan();
        for (uint256 i; i < plan.tokens.length; i++) {
            if (plan.tokens[i] == address(0)) revert BadPlan();
            for (uint256 j; j < i; j++) {
                if (plan.tokens[j] == plan.tokens[i]) revert BadPlan();
            }
        }
    }

    function _supersetOf(address[] calldata nextTokens, address[] storage prev) internal view {
        for (uint256 i; i < prev.length; i++) {
            bool found;
            for (uint256 j; j < nextTokens.length; j++) {
                if (nextTokens[j] == prev[i]) found = true;
            }
            if (!found) revert TokenDropped();
        }
    }

    function _snapshot(uint256 vaultId, address wallet)
        internal
        view
        returns (uint256 nativeBal, uint256[] memory amounts, uint256 moves)
    {
        nativeBal = wallet.balance;
        address[] storage tokens = _tokens[vaultId];
        amounts = new uint256[](tokens.length);
        if (nativeBal > 0) moves = 1;
        for (uint256 i; i < tokens.length; i++) {
            amounts[i] = _balanceOf(tokens[i], wallet);
            if (amounts[i] > 0) moves++;
        }
    }

    function _sendVault(
        uint256 vaultId,
        address fromWallet,
        address toWallet,
        uint256 nativeBal,
        uint256[] memory amounts,
        uint256 execFee
    ) internal {
        if (nativeBal > 0) _exec(fromWallet, toWallet, nativeBal, "", execFee);
        address[] storage tokens = _tokens[vaultId];
        for (uint256 i; i < tokens.length; i++) {
            if (amounts[i] == 0) continue;
            _exec(fromWallet, tokens[i], 0, abi.encodeCall(IERC20.transfer, (toWallet, amounts[i])), execFee);
        }
    }

    function _split(uint256 total, Heir[] storage heirs)
        internal
        view
        returns (uint256[] memory amounts, uint256 calls)
    {
        amounts = new uint256[](heirs.length);
        uint256 paid;
        for (uint256 i; i < heirs.length; i++) {
            uint256 amount = i + 1 == heirs.length ? total - paid : total * heirs[i].bps / BPS;
            paid += amount;
            amounts[i] = amount;
            if (amount > 0) calls++;
        }
    }

    function _exec(address wallet, address to, uint256 value, bytes memory data, uint256 execFee) internal {
        bytes memory ret = IBrain(wallet).execute{value: execFee}(to, value, data, 0);
        if (ret.length >= 32 && !abi.decode(ret, (bool))) revert TransferFailed();
    }

    function _balanceOf(address token, address account) internal view returns (uint256) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeCall(IERC20.balanceOf, (account)));
        if (!ok || ret.length < 32) revert TransferFailed();
        return abi.decode(ret, (uint256));
    }

    function _guardianBit(uint256 vaultId, address who) internal view returns (uint8) {
        address[3] storage g = _guardians[vaultId];
        if (who == g[0]) return 1;
        if (who == g[1]) return 2;
        if (who == g[2]) return 4;
        revert NotGuardian();
    }

    function _recover(uint256 vaultId, uint256 deadline, bytes calldata sig) internal view returns (address) {
        if (sig.length != 65) revert BadSig();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > HALF_N) revert BadSig();
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert BadSig();
        address signer = ecrecover(hashCheckIn(vaultId, deadline), v, r, s);
        if (signer == address(0)) revert BadSig();
        return signer;
    }

    function _existing(uint256 vaultId) internal view returns (Vault storage v) {
        v = vaults[vaultId];
        if (v.owner == address(0)) revert NoVault();
    }

    function _refund(uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert Fee(0, amount);
    }
}
