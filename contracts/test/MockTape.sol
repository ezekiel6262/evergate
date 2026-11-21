// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ICircuits} from "../src/ITapeOut.sol";

/// @notice Stand-in for a processor. step() follows lib/circuit.ts.
///         N and k are pinned on the token, the way a vault wrapper pins them.
///         The NAND proof is `npm run check`, not this file.
contract MockCircuits is ICircuits {
    uint256 public nextId = 1;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(uint256 => uint8) public nOf;
    mapping(uint256 => uint8) public kOf;

    function mint(address to, uint8 n, uint8 k) external returns (uint256 id) {
        id = nextId++;
        ownerOf[id] = to;
        nOf[id] = n;
        kOf[id] = k;
    }

    function approve(address to, uint256 id) external {
        require(msg.sender == ownerOf[id], "not holder");
        getApproved[id] = to;
    }

    function transferFrom(address from, address to, uint256 id) external {
        require(ownerOf[id] == from, "from");
        require(msg.sender == from || getApproved[id] == msg.sender, "not approved");
        ownerOf[id] = to;
        getApproved[id] = address(0);
    }

    function step(uint256 id, bytes calldata state, bytes calldata inputs)
        external
        view
        returns (bytes memory newState, bytes memory outputs)
    {
        require(ownerOf[id] != address(0), "no circuit");
        uint256 phase = state.length == 0 ? 0 : uint8(state[0]) & 3;
        (uint8 next, uint8 flags) = _phase(phase, _bits(inputs), nOf[id], kOf[id]);
        newState = abi.encodePacked(next);
        outputs = abi.encodePacked(uint8(next | flags));
    }

    function _bits(bytes calldata inputs) internal pure returns (uint256 bits) {
        if (inputs.length > 0) bits = uint8(inputs[0]);
        if (inputs.length > 1) bits |= uint256(uint8(inputs[1])) << 8;
    }

    /// @dev flags: bit 2 is the alert output, bit 3 is the release output.
    function _phase(uint256 phase, uint256 bits, uint256 n, uint256 k)
        internal
        pure
        returns (uint8 next, uint8 flags)
    {
        next = uint8(phase);
        if (phase == 0) {
            if ((bits & 16) == 0 && (bits & 15) >= n) {
                next = 1;
                flags = 4;
            }
        } else if (phase == 1) {
            if ((bits & 16) != 0) {
                next = 0;
            } else if (_count((bits >> 5) & 7) >= k && (bits & 256) != 0) {
                next = 2;
                flags = 8;
            }
        } else if (phase == 2) {
            if ((bits & 512) != 0) next = 3;
            else flags = 8;
        } else {
            next = 3;
        }
    }

    function _count(uint256 votes) internal pure returns (uint256) {
        return (votes & 1) + ((votes >> 1) & 1) + ((votes >> 2) & 1);
    }
}

contract MockOpener {
    uint256 public FEE = 0.08 ether;
    mapping(bytes32 => bool) public opened;
    mapping(bytes32 => address) public brains;

    function accountOf(address circuits, uint256 tokenId) public view returns (address) {
        return brains[_key(circuits, tokenId)];
    }

    function isOpened(address circuits, uint256 tokenId) external view returns (bool) {
        return opened[_key(circuits, tokenId)];
    }

    function open(address circuits, uint256 tokenId) external payable {
        require(msg.value == FEE, "open fee");
        bytes32 key = _key(circuits, tokenId);
        require(!opened[key], "opened");
        opened[key] = true;
        brains[key] = address(new MockBrain(circuits, tokenId, address(this)));
    }

    function _key(address circuits, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encode(circuits, tokenId));
    }

    receive() external payable {}
}

contract MockBrain {
    address public immutable circuits;
    uint256 public immutable tokenId;
    address public immutable sink;
    uint256 public constant FEE = 0.0013 ether;

    constructor(address circuits_, uint256 tokenId_, address sink_) {
        circuits = circuits_;
        tokenId = tokenId_;
        sink = sink_;
    }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory ret)
    {
        require(operation == 0, "OnlyCall");
        require(msg.sender == MockCircuits(circuits).ownerOf(tokenId), "NotOwner");
        require(msg.value == FEE, "ProtocolFeeTooLow");
        (bool paid,) = sink.call{value: msg.value}("");
        require(paid, "fee");
        bool ok;
        (ok, ret) = to.call{value: value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    receive() external payable {}
}

contract MockToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
