// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DAO} from "../src/DAO.sol";
import {RWA} from "../src/RWA.sol";

/**
 * @notice Script to transfer NFT ownership from daoTreasury to their respective RWAGovernors
 * This fixes the issue where TBAs can't be controlled because Governors don't own the NFTs
 * 
 * Usage: forge script script/TransferNFTsToGovernors.s.sol:TransferNFTsToGovernors --rpc-url sepolia --broadcast
 */
contract TransferNFTsToGovernors is Script {
    // Update these addresses to match your deployment
    address constant DAO_ADDRESS = 0x132AD6fB8EaF3065C831Febf5788AbDa4B72c76C;
    address constant RWA_ADDRESS = 0x914c81B1A6C3aCF7B5903a7EDcB53C59373C6B57;

    function run() external {
        // Get the DAO Treasury's private key from env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        DAO dao = DAO(payable(DAO_ADDRESS));
        RWA rwa = RWA(RWA_ADDRESS);
        
        address daoTreasury = dao.daoTreasury();
        console.log("DAO Treasury:", daoTreasury);

        // The deployer must be the current owner OR approved to transfer
        console.log("Note: The private key used must be the NFT owner's key");
        console.log("");
        
        // Check how many NFTs exist (try up to 10)
        uint256 maxNftId = 10;
        for (uint256 nftId = 0; nftId < maxNftId; nftId++) {
            try rwa.ownerOf(nftId) returns (address owner) {
                console.log("=== NFT #", nftId, "===");
                console.log("Current owner:", owner);
                
                // Get the governor for this NFT
                address governor = dao.rwaDaos(nftId);
                console.log("Governor:", governor);
                
                if (governor == address(0)) {
                    console.log("No governor found, skipping");
                    console.log("");
                    continue;
                }
                
                if (owner == governor) {
                    console.log("Already owned by governor - OK");
                    console.log("");
                } else {
                    // Check if deployer is the owner
                    if (owner != deployer) {
                        console.log("ERROR: Deployer", deployer, "is not the owner!");
                        console.log("Cannot transfer. Please use the owner's private key.");
                        console.log("");
                        continue;
                    }
                    
                    console.log("Transferring to governor...");
                    rwa.transferFrom(owner, governor, nftId);
                    
                    // Verify transfer
                    address newOwner = rwa.ownerOf(nftId);
                    if (newOwner == governor) {
                        console.log("SUCCESS: NFT transferred to governor");
                    } else {
                        console.log("FAILED: NFT still owned by", newOwner);
                    }
                    console.log("");
                }
            } catch {
                // NFT doesn't exist, stop checking
                if (nftId == 0) {
                    console.log("No NFTs found");
                } else {
                    console.log("Found", nftId, "NFTs total");
                }
                break;
            }
        }

        vm.stopBroadcast();
        console.log("Transfer complete!");
    }
}
