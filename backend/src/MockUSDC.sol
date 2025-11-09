// src/MockUSDC.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Simple ERC20 token for testing that mimics USDC.
 * - Uses 6 decimals.
 * - Mints 10 million tokens to the deployer.
 */
contract MockUSDC is ERC20, Ownable {
    
    constructor(address initialOwner) 
        ERC20("Mock USDC", "mUSDC") 
        Ownable(initialOwner)
    {
    // Mint 10,000,000 mUSDC to the deployer address
    // Multiply by 10**6 because USDC uses 6 decimals
        _mint(msg.sender, 10_000_000 * (10**6)); 
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}