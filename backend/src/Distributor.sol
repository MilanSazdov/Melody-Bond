// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DAO.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Helper contract for distributing funds to RWA NFT investors
contract Distributor {
    DAO public mainDao;

    // Create the Distributor with the main DAO address
    constructor(address _mainDao) {
        mainDao = DAO(_mainDao);
    }

    /**
     * @dev Main distribution function.
     * This function is called by RWAGovernor through the TBA wallet.
     * @param nftId The ID of the NFT whose funds are being distributed.
     * @param totalAmount The total amount of tokens to distribute.
     * @param tokenAddress The token address being distributed (e.g., USDC).
     */
    // 
    function distribute(
        uint256 nftId,
        uint256 totalAmount,
        address tokenAddress
    ) external {
        IERC20 token = IERC20(tokenAddress);

        // Find the original proposalId based on nftId
        uint256 proposalId = mainDao.nftProposalId(nftId);
        require(proposalId != 0 || nftId == 0, "Distributor: Invalid nftId"); // Check whether mapping exists

        // Fetch proposal details to determine total stake (total shares)
        // We use the public getter Solidity creates for `rwaProposals`
        // (bool, address, uint256, uint256 raisedUSDC, ...)
        (
            ,
            ,
            ,
            uint256 totalRaisedUSDC,
            ,
            ,

        ) = mainDao.rwaProposals(proposalId);

        // Total shares equal collected USDC (converted to 18 decimals)
        uint256 totalShares = totalRaisedUSDC * (10**(18 - 6)); // Assumption: USDC = 6 decimals
        require(totalShares > 0, "Distributor: No shares found for this NFT");

        // Pull funds from the TBA wallet (which is msg.sender)
        // TBA must first approve this contract
        token.transferFrom(msg.sender, address(this), totalAmount);

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
                    token.transfer(investor, payoutAmount);
                }
            }
        }
    }
}