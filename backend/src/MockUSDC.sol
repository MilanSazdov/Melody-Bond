// src/MockUSDC.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Jednostavan ERC20 token za testiranje koji imitira USDC.
 * - Ima 6 decimala.
 * - Mint-uje 10 miliona tokena deployer-u.
 */
contract MockUSDC is ERC20, Ownable {
    
    constructor(address initialOwner) 
        ERC20("Mock USDC", "mUSDC") 
        Ownable(initialOwner)
    {
        // Mint 10,000,000 mUSDC na adresu onoga ko deploy-uje
        // Koristimo 10**6 jer USDC ima 6 decimala
        _mint(msg.sender, 10_000_000 * (10**6)); 
    }

    /**
     * @dev Prepisujemo funkciju da vrati 6 decimala.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @dev Opciona funkcija koja omogućava vlasniku da mint-uje još tokena ako zatreba.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}