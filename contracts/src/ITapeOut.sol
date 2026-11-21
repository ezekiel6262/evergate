// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The processor that stores a vault's rule and evaluates one beat.
///         step() is a view: the keeper keeps the latch bits and obeys the result.
interface ICircuits {
    function step(uint256 id, bytes calldata state, bytes calldata inputs)
        external
        view
        returns (bytes memory newState, bytes memory outputs);

    function ownerOf(uint256 tokenId) external view returns (address);

    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice Opens the brain wallet bound to a circuit. Selector 0x0a0e5c9d
///         (open(address,uint256)) is present on the X Layer opener.
interface IOpener {
    function open(address circuits, uint256 tokenId) external payable;

    function FEE() external view returns (uint256);

    function isOpened(address circuits, uint256 tokenId) external view returns (bool);

    function accountOf(address circuits, uint256 tokenId) external view returns (address);
}

/// @notice ERC-6551 execute. operation 0 is a call. The per-call fee is msg.value;
///         the account reverts if it is short. Do not read EXEC_FEE(); that view reverts.
interface IBrain {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}
