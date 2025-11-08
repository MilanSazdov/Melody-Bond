// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC6551Registry {
    
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address);

    
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address);
}


interface IERC6551Account {
    
    function execute(address to, uint256 value, bytes calldata data) external payable returns (bytes memory);
}