// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {console} from "forge-std/console.sol";

import {Script} from "forge-std/Script.sol";
import {DAO} from "../src/DAO.sol";
import {GovToken} from "../src/GovToken.sol";
import {Timelock} from "../src/Timelock.sol";
import {RWA} from "../src/RWA.sol";
import {RWAGovernor} from "../src/RWAGovernor.sol";
import {VotingPaymaster} from "../src/VotingPaymaster.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol"; 

import {Distributor} from "../src/Distributor.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract Deploy is Script {

    // --- Addresses for Sepolia Testnet ---
    // address constant USDC_ADDRESS = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant ENTRYPOINT_ADDRESS = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    address constant ERC6551_REGISTRY_ADDRESS = 0x000000006551c19487814612e58FE06813775758;

    function run() external {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    address deployerAddress = vm.addr(deployerPrivateKey);

    vm.startBroadcast(deployerPrivateKey);

    // --- Deploy GovToken ---
    // Deployer is a temporary owner to be able to transfer ownership
    GovToken govToken = new GovToken(deployerAddress);
    console.log("GovToken deployed at:", address(govToken));

    // --- Deploy MockUSDC ---
    // Deployer is the owner and receives 10M mock USDC
    MockUSDC mockUsdc = new MockUSDC(deployerAddress);
    console.log("MockUSDC deployed at:", address(mockUsdc));
    console.log("Deployer (", deployerAddress, ") received 10,000,000 mUSDC.");

    // --- Deploy main Timelock ---
    // Use empty proposers array to avoid granting open (address(0)) proposer/canceller role
    // Keep executors open (address(0)) so any address can execute queued ops after delay
    address[] memory proposers = new address[](0);
    address[] memory executors = new address[](1);
    executors[0] = address(0); // open execution
    Timelock mainTimelock = new Timelock(
        1 minutes,
        proposers,
        executors,
        deployerAddress // Deployer is a temporary admin
    );
    console.log("Main Timelock deployed at:", address(mainTimelock)); 

    // --- Deploy RWA (NFT) contract ---
    // Deployer is a temporary owner
    RWA rwaNft = new RWA(deployerAddress);
    console.log("RWA NFT deployed at:", address(rwaNft)); 

    // --- Deploy RWAGovernor LOGIC (Template) ---
    // This is only a template that DAO.sol will clone
    RWAGovernor rwaGovernorLogic = new RWAGovernor();
    console.log("RWAGovernor logic (template) deployed at:", address(rwaGovernorLogic)); 

    // --- Deploy main DAO contract ---
    address daoTreasury = deployerAddress;
    // For now, the treasury is the deployer
    console.log("DAO Treasury (deployer) is:", daoTreasury);

    // Passing address of the deployed MockUSDC contract to DAO constructor
    DAO dao = new DAO( 
        IVotes(address(govToken)),
        TimelockController(payable(address(mainTimelock))),
        address(mockUsdc),
        address(rwaNft),
        ERC6551_REGISTRY_ADDRESS,
        address(rwaGovernorLogic),
        daoTreasury
    );
    console.log("DAO deployed at:", address(dao)); 

    Distributor distributor = new Distributor(payable(address(dao)));
    console.log("Distributor deployed at:", address(distributor));

    // --- Deploy VotingPaymaster ---
    VotingPaymaster paymaster = new VotingPaymaster(
        address(govToken),
        address(dao),
        ENTRYPOINT_ADDRESS
    );
    console.log("VotingPaymaster deployed at:", address(paymaster));

    console.log("Setting up roles and ownerships...");

    _setupTimelockRoles(mainTimelock, address(dao), deployerAddress);

    // Transfer ownership of RWA.sol to DAO
    // (so that DAO can mint NFTs)
    rwaNft.transferOwnership(address(dao));
    require(rwaNft.owner() == address(dao), "RWA owner not DAO");
    console.log("RWA ownership transferred to DAO."); 

    // Transfer ownership of GovToken.sol to DAO
    // (so that DAO can mint GOV tokens to the treasury)
    govToken.transferOwnership(address(dao));
    require(govToken.owner() == address(dao), "GovToken owner not DAO");
    console.log("GovToken ownership transferred to DAO."); 

    vm.stopBroadcast();
}

    function _setupTimelockRoles(
        Timelock mainTimelock,
        address daoAddr,
        address deployerAddr
    ) internal {
        bytes32 proposerRole = mainTimelock.PROPOSER_ROLE();
        bytes32 cancellerRole = mainTimelock.CANCELLER_ROLE();
        mainTimelock.grantRole(proposerRole, daoAddr);
        mainTimelock.grantRole(cancellerRole, daoAddr);
        require(mainTimelock.hasRole(proposerRole, daoAddr), "DAO proposer role failed");
        require(mainTimelock.hasRole(cancellerRole, daoAddr), "DAO canceller role failed");

        bytes32 adminRole = mainTimelock.DEFAULT_ADMIN_ROLE();
        mainTimelock.renounceRole(adminRole, deployerAddr);
        require(!mainTimelock.hasRole(adminRole, deployerAddr), "Admin renounce failed");
        console.log("Timelock roles configured. DAO is proposer & canceller; deployer renounced admin.");
    }
}