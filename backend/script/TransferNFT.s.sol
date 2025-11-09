// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @notice Simple script to transfer a specific NFT to a specific address
 * Usage: forge script script/TransferNFT.s.sol:TransferNFT --rpc-url sepolia --broadcast --legacy
 */
contract TransferNFT is Script {
    // NFT contract address
    address constant NFT_ADDRESS = 0x914c81B1A6C3aCF7B5903a7EDcB53C59373C6B57;
    
    // NFT ID to transfer
    uint256 constant NFT_ID = 1;
    
    // Recipient (Governor) address - get this from the governance page error
    address constant RECIPIENT = 0x1790dA14028F354Ec30510b4D38bEbd0A0781A59;

    function run() external {
        // Get the private key from env
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(privateKey);
        
        console.log("Sender:", sender);
        console.log("NFT Contract:", NFT_ADDRESS);
        console.log("NFT ID:", NFT_ID);
        console.log("Recipient (Governor):", RECIPIENT);
        console.log("");
        
        IERC721 nft = IERC721(NFT_ADDRESS);
        
        // Check current owner
        address currentOwner = nft.ownerOf(NFT_ID);
        console.log("Current owner:", currentOwner);
        
        if (currentOwner == RECIPIENT) {
            console.log("NFT already owned by recipient!");
            return;
        }
        
        if (currentOwner != sender) {
            console.log("ERROR: You don't own this NFT!");
            console.log("Current owner:", currentOwner);
            console.log("Your address:", sender);
            return;
        }
        
        vm.startBroadcast(privateKey);
        
        console.log("Transferring NFT...");
        nft.transferFrom(sender, RECIPIENT, NFT_ID);
        
        vm.stopBroadcast();
        
        // Verify
        address newOwner = nft.ownerOf(NFT_ID);
        console.log("New owner:", newOwner);
        
        if (newOwner == RECIPIENT) {
            console.log("SUCCESS: NFT transferred!");
        } else {
            console.log("FAILED: Transfer did not complete");
        }
    }
}
