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
 * @dev Logical implementation for a DAO governing a single RWA NFT
 */
contract RWAGovernor is
    Initializable,
    GovernorUpgradeable,
    GovernorCountingSimpleUpgradeable // ADD this
{
    uint256 public nftId;
    DAO public mainDao;
    address public tbaAddress; // Address of the controlled ERC-6551 wallet

    function initialize(
        uint256 _nftId,
        address _tbaAddress, 
        address payable _mainDao 
    ) external initializer {
        
        nftId = _nftId;
        tbaAddress = _tbaAddress;
        mainDao = DAO(_mainDao); 

        string memory name = string(
            abi.encodePacked("RWA Governor for NFT #", Strings.toString(_nftId))
        );
        __Governor_init(name);
        
        __GovernorCountingSimple_init(); 
    }

    function _getVotes(address account, uint256 /* blockNumber */, bytes memory /* params */) internal view override returns (uint256) {
        // Returns CURRENT voting power
        return mainDao.rwaShares(nftId, account);
    }


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

    function _executeOperations(
        uint256 /* proposalId */,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 /* descriptionHash */
    ) internal override {
        address rwaAddress = address(mainDao.rwaNftContract());
        for (uint256 i = 0; i < targets.length; ++i) {
            if (targets[i] == rwaAddress) {
                // The governor itself owns the NFT; call RWA directly to satisfy owner checks
                (bool ok, ) = targets[i].call{value: values[i]}(calldatas[i]);
                require(ok, "RWAGovernor: direct RWA call failed");
            } else {
                // Instruct the TBA wallet to execute the call, forwarding exact ETH value
                IERC6551Account(tbaAddress).executeCall{value: values[i]}(
                    targets[i],
                    values[i],
                    calldatas[i]
                );
            }
        }
    }

    // --- Voting configuration ---

    function votingDelay() public pure override returns (uint256) {
        return 0;
        // 0 blocks
    }

    function votingPeriod() public pure override returns (uint256) {
        return 120;
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 0;
    }

    function quorum(uint256 /* timepoint */) public pure override returns (uint256) {
        return 0;
    }

    function clock() public view virtual override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public view virtual override returns (string memory) {
        return "mode=timestamp";
    }

    function proposeProfitDistribution(
        address distributorAddress,
        address tokenAddress,
        uint256 amount
    ) external returns (uint256 proposalId) {
        
    // Prepare calldata for approve(address,uint256)
        bytes memory calldataApprove = abi.encodeWithSignature(
            "approve(address,uint256)",
            distributorAddress,
            amount
        );

    // Prepare calldata for distribute(uint256,uint256,address)
        bytes memory calldataDistribute = abi.encodeWithSignature(
            "distribute(uint256,uint256,address)",
            nftId, // The ID of this NFT is already stored in the contract
            amount,
            tokenAddress
        );

    // Pack both actions into a single proposal
        address[] memory targets = new address[](2);
        targets[0] = tokenAddress;
        targets[1] = distributorAddress;

        uint256[] memory values = new uint256[](2);
    // Both actions send no ETH
        values[0] = 0;
        values[1] = 0;

        bytes[] memory calldatas = new bytes[](2);
        calldatas[0] = calldataApprove;
        calldatas[1] = calldataDistribute;

    string memory description = "Proposal to distribute profits to investors.";

    // Call the standard propose function with these actions
    // The investor check (msg.sender eligibility) is performed by super.propose
        return super.propose(targets, values, calldatas, description);
    }

    // Helper: current owner of the governed NFT (for frontend debugging)
    function nftOwner() external view returns (address) {
        return mainDao.rwaNftContract().ownerOf(nftId);
    }
}