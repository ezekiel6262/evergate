// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IOpener} from "../src/ITapeOut.sol";
import {EvergateKeeper} from "../src/EvergateKeeper.sol";
import {MockBrain, MockCircuits, MockOpener, MockToken} from "./MockTape.sol";

contract EvilToken {
    EvergateKeeper public keeper;
    uint256 public vaultId;
    mapping(address => uint256) public balanceOf;

    function arm(EvergateKeeper keeper_, uint256 vaultId_) external {
        keeper = keeper_;
        vaultId = vaultId_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address, uint256) external returns (bool) {
        keeper.poke(vaultId);
        return true;
    }
}

contract EvergateKeeperTest is Test {
    uint256 internal constant OWNER_KEY = 0xA11CE;
    uint64 internal constant MONTH = 30 days;

    MockCircuits internal circuits;
    MockOpener internal opener;
    EvergateKeeper internal keeper;
    MockToken internal token;
    uint256 internal openFee;

    address internal owner;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal g1 = makeAddr("g1");
    address internal g2 = makeAddr("g2");
    address internal g3 = makeAddr("g3");

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        circuits = new MockCircuits();
        opener = new MockOpener();
        keeper = new EvergateKeeper(circuits, IOpener(address(opener)));
        token = new MockToken();
        openFee = opener.FEE();
        vm.deal(owner, 100 ether);
        vm.warp(1_000_000);
    }

    function test_packBits() public view {
        assertEq(keeper.packInputs(3, false, 5, true, false), hex"a301");
    }

    function test_createRefundsTheOpenFeeExcess() public {
        uint256 id = _circuit(3, 2);
        uint256 before = owner.balance;
        vm.prank(owner);
        uint256 vaultId = keeper.create{value: 0.1 ether}(_plan(id, 3, 2, MONTH, MONTH, _one(address(token))));
        assertEq(owner.balance, before - opener.FEE());
        assertEq(address(opener).balance, opener.FEE());
        assertEq(circuits.ownerOf(id), address(keeper));
        assertTrue(opener.isOpened(address(circuits), id));
        (address got,,,,,,,,,) = keeper.vaults(vaultId);
        assertEq(got, owner);
    }

    function test_createSkipsTheFeeWhenTheWalletIsOpen() public {
        uint256 id = _circuit(3, 2);
        opener.open{value: opener.FEE()}(address(circuits), id);
        uint256 before = owner.balance;
        vm.prank(owner);
        keeper.create(_plan(id, 3, 2, MONTH, MONTH, _one(address(token))));
        assertEq(owner.balance, before);
    }

    function test_pinRejectsADifferentMissCount() public {
        uint256 id = _circuit(4, 2);
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.Pin.selector);
        keeper.create{value: openFee}(_plan(id, 3, 2, MONTH, MONTH, _one(address(token))));
    }

    function test_pinRejectsASmallerQuorum() public {
        uint256 id = _circuit(3, 1);
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.Pin.selector);
        keeper.create{value: openFee}(_plan(id, 3, 2, MONTH, MONTH, _one(address(token))));
    }

    function test_badPlans() public {
        uint256 id = _circuit(3, 2);
        EvergateKeeper.Plan memory plan = _plan(id, 3, 2, MONTH, MONTH, _one(address(token)));
        plan.n = 0;
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.BadPlan.selector);
        keeper.create{value: openFee}(plan);

        plan.n = 3;
        plan.k = 4;
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.BadPlan.selector);
        keeper.create{value: openFee}(plan);

        plan.k = 2;
        plan.interval = 0;
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.BadPlan.selector);
        keeper.create{value: openFee}(plan);

        plan.interval = MONTH;
        plan.heirs[0].bps = 5999;
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.BadPlan.selector);
        keeper.create{value: openFee}(plan);
    }

    function test_missesRaiseOneAlertAndTheWaitDoesNotReset() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        vm.warp(block.timestamp + MONTH * 3 - 1);
        keeper.poke(vaultId);
        (, uint256 circuitId,, uint64 alertAt,,, uint8 n, uint8 k, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 0);
        assertEq(n, 3);
        assertEq(k, 2);
        assertEq(circuitId, circuits.nextId() - 1);

        vm.warp(block.timestamp + 1);
        keeper.poke(vaultId);
        (,,, alertAt,,,,, state,) = keeper.vaults(vaultId);
        assertEq(state, 1);
        assertEq(alertAt, block.timestamp);

        uint64 started = alertAt;
        vm.warp(block.timestamp + 10 days);
        keeper.poke(vaultId);
        (,,, alertAt,,,,, state,) = keeper.vaults(vaultId);
        assertEq(state, 1);
        assertEq(alertAt, started);
    }

    function test_checkInCancelsTheAlertAndTheSignatureWorks() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        vm.warp(block.timestamp + MONTH * 3);
        keeper.poke(vaultId);
        vm.prank(g1);
        keeper.approve(vaultId);

        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = keeper.hashCheckIn(vaultId, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, digest);
        keeper.checkInFor(vaultId, deadline, abi.encodePacked(r, s, v));

        (,, uint64 last,, uint64 interval,,,, uint8 state, uint8 approvals) = keeper.vaults(vaultId);
        assertEq(state, 0);
        assertEq(approvals, 0);
        assertEq(last, block.timestamp);
        assertEq(interval, MONTH);

        vm.warp(block.timestamp + 1);
        vm.prank(alice);
        vm.expectRevert(EvergateKeeper.NotOwner.selector);
        keeper.checkIn(vaultId);

        vm.warp(deadline + 1);
        vm.expectRevert(EvergateKeeper.Expired.selector);
        keeper.checkInFor(vaultId, deadline, abi.encodePacked(r, s, v));
    }

    function test_ownerCannotCancelOnceTheGateIsOpen() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        _openGate(vaultId);
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.TooLate.selector);
        keeper.checkIn(vaultId);
        (,,,,,,,, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 2);
    }

    function test_claimPaysTheRemainderToTheLastHeir() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        address wallet = keeper.walletOf(vaultId);
        vm.deal(wallet, 101);
        token.mint(wallet, 10_000);
        _openGate(vaultId);

        uint256 fee = MockBrain(payable(wallet)).FEE();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        keeper.claim{value: fee * 4}(vaultId, fee);

        assertEq(alice.balance, 1 ether - fee * 4 + 60);
        assertEq(bob.balance, 41);
        assertEq(token.balanceOf(alice), 6_000);
        assertEq(token.balanceOf(bob), 4_000);
        assertEq(wallet.balance, 0);
        assertEq(token.balanceOf(wallet), 0);
        (,,,,,,,, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 3);

        vm.expectRevert(EvergateKeeper.Released.selector);
        keeper.poke(vaultId);
    }

    function test_shortExecuteFeeRevertsInsideTheWallet() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        vm.deal(keeper.walletOf(vaultId), 100);
        _openGate(vaultId);
        vm.expectRevert(bytes("ProtocolFeeTooLow"));
        keeper.claim{value: 2}(vaultId, 1);
    }

    function test_withdrawOnlyWhileTheCircuitStaysActive() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        address wallet = keeper.walletOf(vaultId);
        vm.deal(wallet, 1 ether);
        token.mint(wallet, 50);
        uint256 fee = MockBrain(payable(wallet)).FEE();

        vm.warp(block.timestamp + MONTH * 3);
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.NotActive.selector);
        keeper.withdraw{value: fee}(vaultId, address(0), owner, 1 ether, fee);
        (,,,,,,,, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 0);

        vm.prank(owner);
        keeper.checkIn(vaultId);
        uint256 before = owner.balance;
        vm.prank(owner);
        keeper.withdraw{value: fee}(vaultId, address(0), owner, 1 ether, fee);
        assertEq(owner.balance, before - fee + 1 ether);
        vm.prank(owner);
        keeper.withdraw{value: fee}(vaultId, address(token), owner, 50, fee);
        assertEq(token.balanceOf(owner), 50);
    }

    function test_replacePlanMovesTheFundsAndRetiresTheOldCircuit() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        address oldWallet = keeper.walletOf(vaultId);
        vm.deal(oldWallet, 7 ether);
        token.mint(oldWallet, 80);
        uint256 fee = MockBrain(payable(oldWallet)).FEE();
        (, uint256 oldCircuit,,,,,,,,) = keeper.vaults(vaultId);

        uint256 nextCircuit = _circuit(1, 1);
        address[] memory tokens = _one(address(token));
        EvergateKeeper.Plan memory plan = _plan(nextCircuit, 1, 1, 60, 120, tokens);

        vm.prank(owner);
        keeper.replacePlan{value: openFee + fee * 2}(vaultId, plan, fee);

        address newWallet = keeper.walletOf(vaultId);
        assertTrue(newWallet != oldWallet);
        assertEq(newWallet.balance, 7 ether);
        assertEq(token.balanceOf(newWallet), 80);
        assertEq(oldWallet.balance, 0);
        assertEq(keeper.circuitVault(oldCircuit), vaultId);
        assertEq(keeper.circuitVault(nextCircuit), vaultId);

        vm.expectRevert(EvergateKeeper.CircuitUsed.selector);
        vm.prank(owner);
        keeper.create{value: openFee}(_plan(oldCircuit, 3, 2, MONTH, MONTH, tokens));

        (,,,,,,,, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 0);
    }

    function test_replacePlanKeepsEveryOldToken() public {
        uint256 vaultId = _vault(3, 2, MONTH, MONTH);
        uint256 nextCircuit = _circuit(3, 2);
        vm.prank(owner);
        vm.expectRevert(EvergateKeeper.TokenDropped.selector);
        keeper.replacePlan{value: openFee}(vaultId, _plan(nextCircuit, 3, 2, MONTH, MONTH, new address[](0)), 0);
    }

    function test_demoClock() public {
        uint256 vaultId = _vault(2, 1, 60, 120);
        vm.warp(block.timestamp + 60);
        keeper.poke(vaultId);
        (,,,,,,,, uint8 state,) = keeper.vaults(vaultId);
        assertEq(state, 0);
        vm.warp(block.timestamp + 60);
        keeper.poke(vaultId);
        (,,,,,,,, state,) = keeper.vaults(vaultId);
        assertEq(state, 1);
        vm.warp(block.timestamp + 120);
        vm.prank(g1);
        keeper.approve(vaultId);
        (,,,,,,,, state,) = keeper.vaults(vaultId);
        assertEq(state, 2);
    }

    function test_reentrancyDuringClaimIsRejected() public {
        EvilToken evil = new EvilToken();
        uint256 circuitId = _circuit(3, 2);
        vm.prank(owner);
        uint256 vaultId = keeper.create{value: openFee}(_plan(circuitId, 3, 2, MONTH, MONTH, _one(address(evil))));
        evil.arm(keeper, vaultId);
        evil.mint(keeper.walletOf(vaultId), 100);
        _openGate(vaultId);
        uint256 fee = MockBrain(payable(keeper.walletOf(vaultId))).FEE();
        vm.expectRevert(EvergateKeeper.Locked.selector);
        keeper.claim{value: fee * 2}(vaultId, fee);
    }

    function _vault(uint8 n, uint8 k, uint64 interval, uint64 waitPeriod) internal returns (uint256 vaultId) {
        uint256 circuitId = _circuit(n, k);
        vm.prank(owner);
        vaultId = keeper.create{value: openFee}(_plan(circuitId, n, k, interval, waitPeriod, _one(address(token))));
    }

    function _circuit(uint8 n, uint8 k) internal returns (uint256 id) {
        id = circuits.mint(owner, n, k);
        vm.prank(owner);
        circuits.approve(address(keeper), id);
    }

    function _openGate(uint256 vaultId) internal {
        vm.warp(block.timestamp + MONTH * 3);
        keeper.poke(vaultId);
        vm.prank(g1);
        keeper.approve(vaultId);
        vm.warp(block.timestamp + MONTH);
        vm.prank(g2);
        keeper.approve(vaultId);
    }

    function _one(address item) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = item;
    }

    function _plan(uint256 circuitId, uint8 n, uint8 k, uint64 interval, uint64 waitPeriod, address[] memory tokens)
        internal
        view
        returns (EvergateKeeper.Plan memory plan)
    {
        EvergateKeeper.Heir[] memory heirs = new EvergateKeeper.Heir[](2);
        heirs[0] = EvergateKeeper.Heir(alice, 6_000);
        heirs[1] = EvergateKeeper.Heir(bob, 4_000);
        plan.circuitId = circuitId;
        plan.interval = interval;
        plan.waitPeriod = waitPeriod;
        plan.n = n;
        plan.k = k;
        plan.guardians = [g1, g2, g3];
        plan.heirs = heirs;
        plan.tokens = tokens;
    }
}
