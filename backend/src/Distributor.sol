// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DAO} from "./DAO.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Helper contract for distributing funds to RWA NFT investors
contract Distributor {
    DAO public mainDao;

    // Create the Distributor with the main DAO address
    constructor(address payable _mainDao) { // FIX: Make _mainDao payable
        mainDao = DAO(_mainDao); // This cast now works
    }

    /**
     * @dev Main distribution function.
     * ...
     */
    // ... (rest of the file is correct) ...
    function distribute(
        uint256 nftId,
        uint256 totalAmount,
        address tokenAddress
    ) external {
        IERC20 token = IERC20(tokenAddress);
        // Find the original proposalId based on nftId
        uint256 proposalId = mainDao.nftProposalId(nftId);
        require(proposalId != 0 || nftId == 0, "Distributor: Invalid nftId");
        // Check whether mapping exists

        // Fetch proposal details to determine total stake (total shares)
        // We use the public getter Solidity creates for `rwaProposals`
        // (bool, address, uint256, uint256 raisedUSDC, ...)
        (
            ,
            ,
            ,
            uint256 totalRaisedUsdc,
            ,
            ,
            
        ) = mainDao.rwaProposals(proposalId);
        // Total shares equal collected USDC (converted to 18 decimals)
        uint256 totalShares = totalRaisedUsdc * (10**(18 - 6));
        // Assumption: USDC = 6 decimals
        require(totalShares > 0, "Distributor: No shares found for this NFT");
        // Pull funds from the TBA wallet (which is msg.sender)
        // TBA must first approve this contract
    require(token.transferFrom(msg.sender, address(this), totalAmount), "transferFrom failed");
        // Get the list of all investors
        address[] memory investors = mainDao.getInvestorList(proposalId);
        // Iterate and send each their proportional share
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 investorShare = mainDao.rwaShares(nftId, investor);

            if (investorShare > 0) {
                // Calculate the proportional payout amount
                uint256 payoutAmount = (totalAmount * investorShare) / totalShares;
                if (payoutAmount > 0) {
                    require(token.transfer(investor, payoutAmount), "transfer failed");
                }
            }
        }
    }
}