// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/GovToken.sol";
import "../src/DAO.sol";
import "../src/Timelock.sol";
import "../src/RWA.sol";
import "../src/VotingPaymaster.sol";
import "../src/interfaces/IERC4337.sol";

contract Deploy is Script {

    address public constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    uint256 public constant TIMELOCK_MIN_DELAY = 60; 

    uint256 public constant PAYMASTER_FUND_AMOUNT = 1 ether;

    function run() external {

        string memory deployerPrivateKeyString = vm.envString("PRIVATE_KEY");
        // Add '0x' prefix if missing (assuming it's a 64-char hex string)
        if (bytes(deployerPrivateKeyString).length == 64 && !has0xPrefix(deployerPrivateKeyString)) {
            deployerPrivateKeyString = string.concat("0x", deployerPrivateKeyString);
        }
        uint256 deployerPrivateKey = vm.parseUint(deployerPrivateKeyString);
        if (deployerPrivateKey == 0) {
            revert("Invalid PRIVATE_KEY in .env");
        }
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying GovToken...");
        GovToken govToken = new GovToken();
        console.log("GovToken deployed to:", address(govToken));

        address[] memory proposers = new address[](1);
        proposers[0] = deployerAddress;
        address[] memory executors = new address[](1);
        executors[0] = address(0);
        
        console.log("Deploying Timelock...");
        Timelock timelock = new Timelock(TIMELOCK_MIN_DELAY, proposers, executors, deployerAddress);
        console.log("Timelock deployed to:", address(timelock));

        console.log("Deploying DAO...");
        DAO dao = new DAO(govToken, timelock);
        console.log("DAO deployed to:", address(dao));

        console.log("Deploying RWA...");
        RWA rwa = new RWA();
        console.log("RWA deployed to:", address(rwa));

        console.log("Deploying VotingPaymaster...");
        VotingPaymaster paymaster = new VotingPaymaster(ENTRY_POINT, address(dao));
        console.log("Paymaster deployed to:", address(paymaster));

        vm.stopBroadcast();

        console.log("Configuring roles...");
        vm.startBroadcast(deployerPrivateKey);

        bytes32 proposerRole = keccak256("PROPOSER_ROLE");
        // executorRole removed as unused; uncomment if restricting executors later
        // bytes32 executorRole = keccak256("EXECUTOR_ROLE");
        bytes32 adminRole = keccak256("TIMELOCK_ADMIN_ROLE");

        console.log("Granting PROPOSER_ROLE to DAO...");
        timelock.grantRole(proposerRole, address(dao));
        
        console.log("Revoking deployer's PROPOSER_ROLE...");
        timelock.revokeRole(proposerRole, deployerAddress); 
        
        console.log("Revoking deployer's TIMELOCK_ADMIN_ROLE...");
        timelock.revokeRole(adminRole, deployerAddress);

        console.log("Transferring RWA ownership to Timelock...");
        rwa.transferOwnership(address(timelock));

        console.log("Funding Paymaster with %s ETH...", PAYMASTER_FUND_AMOUNT / 1 ether);
        paymaster.deposit{value: PAYMASTER_FUND_AMOUNT}();
        console.log("Paymaster funded and deposited.");

        console.log("Delegating deployer's votes...");
        govToken.delegate(deployerAddress);
        console.log("Votes delegated.");
        
        vm.stopBroadcast();

        console.log("=== DEPLOYMENT AND SETUP COMPLETE ===");
    }

    // Helper function to check if string starts with '0x'
    function has0xPrefix(string memory str) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        return strBytes.length >= 2 && strBytes[0] == 0x30 && (strBytes[1] == 0x78 || strBytes[1] == 0x58); // '0x' or '0X'
    }
}