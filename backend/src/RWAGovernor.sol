// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {GovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import {GovernorCountingSimpleUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {DAO} from "./DAO.sol";
import {IERC6551Account} from "./interfaces/IERC6551.sol";

/**
 * @title RWAGovernor (Upgradeable)
 * @dev Logical implementation for a DAO governing a single RWA NFT.
 * Uses OpenZeppelin Upgradeable contracts to support `Clones.clone()`.
 * Directly controls an ERC-6551 (TBA) wallet instead of a Timelock.
 */
contract RWAGovernor is
    Initializable,
    GovernorUpgradeable,
    GovernorCountingSimpleUpgradeable // ADD this
{
    uint256 public nftId;
    DAO public mainDao;
    address public tbaAddress; // Address of the controlled ERC-6551 wallet

    /**
     * @dev Initializer (instead of constructor).
     */
    function initialize(
        uint256 _nftId,
        address _tbaAddress, // Address of the ERC-6551 (TBA) wallet
        address payable _mainDao // FIX: Make _mainDao payable
    ) external initializer {
        // Set state variables
        nftId = _nftId;
        tbaAddress = _tbaAddress;
        mainDao = DAO(_mainDao); // This cast now works

        // Initialize inherited contracts
        
        string memory name = string(
            abi.encodePacked("RWA Governor for NFT #", Strings.toString(_nftId))
        );
        __Governor_init(name);
        
        __GovernorCountingSimple_init(); // ADD this
    }

    /**
     * @dev Returns the number of votes an account has.
     * Reads voting power from the `rwaShares` mapping in the main DAO contract.
     */
    function _getVotes(address account, uint256 /* blockNumber */, bytes memory /* params */) internal view override returns (uint256) {
        // Returns CURRENT voting power
        return mainDao.rwaShares(nftId, account);
    }

    /**
     * @dev Creates a new proposal (e.g., "withdraw money").
     * Allows proposals only from those who hold a stake (investors).
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override returns (uint256 proposalId) {
        // Only investors in this specific NFT can propose
        require(
            mainDao.rwaShares(nftId, msg.sender) > 0,
      
            "RWAGovernor: must be an investor"
        );
        return super.propose(targets, values, calldatas, description);
    }

    /**
     * @dev Executes a proposal after it has passed.
     * Overridden so calls are executed from the ERC-6551 (TBA) wallet.
     */
    function _executeOperations(
        uint256 /* proposalId */,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 /* descriptionHash */
    ) internal override {
        // Examples: "withdraw money" or "change metadata"
        // This Governor (owner/controller of the TBA) instructs the TBA wallet to perform actions
     
           
        // Optionally ensure this contract (Governor) owns/controls the TBA wallet
        // (Depends on TBA implementation, e.g., Ownable)
        // require(IERC173(tbaAddress).owner() == address(this), "Governor must own TBA");
        for (uint256 i = 0; i < targets.length; ++i) {
            // Instruct the TBA wallet to execute the call
            IERC6551Account(tbaAddress).executeCall(
                targets[i],
                values[i],
                calldatas[i]
           
            );
        }
    }

    // --- Voting configuration ---

    function votingDelay() public pure override returns (uint256) {
        return 0;
        // 0 blocks
    }

    function votingPeriod() public pure override returns (uint256) {
        return 120;
        // 10 blocks (adjust as needed)
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 0;
        // 0 tokens needed to create a proposal
    }

    function quorum(uint256 /* timepoint */) public pure override returns (uint256) {
        return 0;
        // 0 votes required for a proposal to pass
    }

    // --- FIX: Add clock() and CLOCK_MODE() for OpenZeppelin v4.8+ ---
    function clock() public view virtual override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public view virtual override returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @dev Helper funkcija za kreiranje predloga za distribuciju profita.
     * Kreira predlog u 2 koraka:
     * 1. Naredi TBA novčaniku da odobri (approve) Distributeru da povuče tokene.
     * 2. Naredi TBA novčaniku da pozove distribute() na Distributer ugovoru.
     *
     * @param distributorAddress Adresa deploy-ovanog Distributor ugovora.
     * @param tokenAddress Adresa ERC20 tokena koji se deli (npr. MockUSDC).
     * @param amount Iznos tokena za distribuciju (u najmanjim jedinicama, npr. 100 * 10**6).
     */
    function proposeProfitDistribution(
        address distributorAddress,
        address tokenAddress,
        uint256 amount
    ) external returns (uint256 proposalId) {
        
        // 1. Pripremi calldata za "approve(address,uint256)"
        bytes memory calldataApprove = abi.encodeWithSignature(
            "approve(address,uint256)",
            distributorAddress,
            amount
        );

        // 2. Pripremi calldata za "distribute(uint256,uint256,address)"
        bytes memory calldataDistribute = abi.encodeWithSignature(
            "distribute(uint256,uint256,address)",
            nftId, // ID ovog NFT-a je već sačuvan u ugovoru
            amount,
            tokenAddress
        );

        // 3. Spakuj obe akcije u jedan predlog
        address[] memory targets = new address[](2);
        targets[0] = tokenAddress;
        targets[1] = distributorAddress;

        uint256[] memory values = new uint256[](2);
        // Obe akcije su bez slanja ETH
        values[0] = 0;
        values[1] = 0;

        bytes[] memory calldatas = new bytes[](2);
        calldatas[0] = calldataApprove;
        calldatas[1] = calldataDistribute;

        string memory description = "Predlog za distribuciju profita investitorima.";

        // 4. Pozovi standardnu 'propose' funkciju sa ovim podacima
        // Provera da li je msg.sender investitor se dešava unutar super.propose
        return super.propose(targets, values, calldatas, description);
    }
}