// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPaymaster} from "./interfaces/IERC4337.sol";
import {UserOperation} from "./interfaces/IERC4337.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


interface IDAO {
    function isRWAGovernor(address) external view returns (bool);
    function rwaShares(uint256 nftId, address account) external view returns (uint256);
}


interface IRWAGovernor {
    function nftId() external view returns (uint256);
}



contract VotingPaymaster is IPaymaster {
    address public immutable token;
    // GovToken address
    address public immutable dao;
    // Main DAO.sol address
    address public immutable entryPoint;
    // --- Function selectors we sponsor ---
    bytes4 public castVoteSelector;
    bytes4 public castVoteWithReasonSelector;
    bytes4 public investSelector;
    

    address public owner;
    constructor(address _token, address _dao, address _entryPoint) {
        token = _token;
        dao = _dao;
        entryPoint = _entryPoint;
        owner = msg.sender;
        
        // Initialize selectors
        castVoteSelector = bytes4(keccak256("castVote(uint256,uint8)"));
        castVoteWithReasonSelector = bytes4(
            keccak256("castVoteWithReason(uint256,uint8,string)")
        );
        investSelector = bytes4(keccak256("invest(uint256,uint256)"));
    }


    function getSender(UserOperation calldata userOp) internal pure returns (address) {
        return userOp.sender;
    }

    function _packValidationData(
        bool success,
        uint256 validUntil,
        uint256 validAfter
    ) internal pure returns (uint256) {
        return (success ? 1 : 0) |
        (validUntil << 1) | (validAfter << 49);
    }


    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* requiredPreFund */
    )
        external
        view
        returns (bytes memory context, uint256 validationData)
    {
        // Verify the call came from the known EntryPoint
        if (msg.sender != entryPoint) {
            revert("VotingPaymaster: Invalid entrypoint");
        }

        // --- Parsing logic ---
        
        bytes calldata callData = userOp.callData;
        bytes4 executeSelector = 0xb61d27f6; // execute(address,uint256,bytes)

        if (callData.length < 4) {
            revert("VotingPaymaster: CallData too short");
        }

        bytes4 outerSelector;
        assembly {
            outerSelector := calldataload(callData.offset)
        }
        outerSelector = outerSelector >> 224;
        if (outerSelector != executeSelector) {
            revert("VotingPaymaster: CallData must be 'execute'");
        }

        (address target, , bytes memory innerCallData) =
            abi.decode(callData[4:], (address, uint256, bytes));


        if (innerCallData.length < 4) {
            revert("VotingPaymaster: Inner callData too short");
        }

        // Manually read the 4-byte function selector from innerCallData
        bytes4 innerSelector;
        assembly {
            // Since `innerCallData` is in memory, skip the first 32 bytes (length)
            innerSelector := mload(add(innerCallData, 0x20))
        }
        innerSelector = innerSelector >> 224;

        bool isSponsorable = false;
        address user = userOp.sender;

        if (innerSelector == investSelector) {
            // Investing is allowed only on the main DAO contract
            if (target == dao) {
                isSponsorable = true;
            }

        } else if (
            innerSelector == castVoteSelector || 
            innerSelector == castVoteWithReasonSelector
        ) {
            // ----- User is calling 'castVote' (on any DAO) -----
            
            if (target == dao) {
                // Sub-case A: Voting on the main DAO
                // Check that the user holds GOV tokens
                if (IVotes(token).getVotes(user) > 0) {
                    isSponsorable = true;
                }
            } else if (IDAO(dao).isRWAGovernor(target) == true) {
                // Sub-case B: Voting on an RWAGovernor
                // 1. Ask the RWAGovernor for its nftId
                uint256 nftId = IRWAGovernor(target).nftId();
                // 2. Ask the main DAO how many shares the user has for that nftId
                if (IDAO(dao).rwaShares(nftId, user) > 0) {
                    isSponsorable = true;
                }
            }
        }

        // If the call is not sponsorable, reject it.
        if (!isSponsorable) {
            revert("VotingPaymaster: Invalid or non-sponsorable call");
        }

        // Sponsor the operation
        context = abi.encode(1, userOp.preVerificationGas);
        // mode = 1 (sponsor)
        validationData = _packValidationData(true, 0, 0);
        // success=true, no time bounds
        
        return (context, validationData);
    }

    function postOp(
        IPaymaster.PostOpMode /* mode */,
        bytes calldata /* context */,
        uint256 /* actualGasCost */
    ) external {}
}