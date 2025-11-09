// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol"; 
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


import {RWA} from "./RWA.sol";
import {IERC6551Registry} from "./interfaces/IERC6551.sol";
import {RWAGovernor} from "./RWAGovernor.sol";
import {GovToken} from "./GovToken.sol";

contract DAO is
    Governor,
    GovernorTimelockControl,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorCountingSimple // ADD this
{
    

    IERC20 public usdcToken;
    RWA public rwaNftContract;
    IERC6551Registry public erc6551Registry;
    address public rwaGovernorLogic; // Address of RWAGovernor implementation
    address public daoTreasury;
    uint256 public constant RWA_FUNDING_PERIOD = 2 minutes;

    enum RWAProposalState { Funding, Succeeded, Failed, Executed }

    struct RWAProposal {
        uint256 id;
        address proposer;
        uint256 targetUSDC;
        uint256 raisedUSDC;
        uint256 deadline;
        string nftMetadataURI;
        RWAProposalState state;
        mapping(address => uint256) investors;
        address[] investorList;
    }

    uint256 public nextRWAProposalId;
    mapping(uint256 => RWAProposal) public rwaProposals;

    mapping(uint256 => mapping(address => uint256)) public rwaShares;
    mapping(uint256 => address) public rwaDaos;

    // Mapping from NFT ID to RWA Proposal ID (For Distributor use)
    mapping(uint256 => uint256) public nftProposalId;
    // Check if an address is a valid RWAGovernor clone
    mapping(address => bool) public isRWAGovernor;

    event RWAFundingProposalCreated(uint256 indexed proposalId, address indexed proposer, uint256 targetUSDC, uint256 deadline);
    event Invested(uint256 indexed proposalId, address indexed investor, uint256 amount);
    event ProposalFinalized(uint256 indexed proposalId, RWAProposalState newState);
    event InvestmentReclaimed(uint256 indexed proposalId, address indexed investor, uint256 amount);
    event RWADeployed(uint256 indexed nftId, address governor, address tba);


    constructor(
        IVotes _token,
        TimelockController _timelock, 

        address _usdcTokenAddress,
        address _rwaNftContractAddress,
        address _erc6551RegistryAddress,
        address _rwaGovernorLogicAddress,
        address _daoTreasuryAddress
    )
        Governor("DAO")
        GovernorTimelockControl(_timelock)
        
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        // GovernorCountingSimple() // No initializer needed for non-upgradeable
    {
        usdcToken = IERC20(_usdcTokenAddress);
        rwaNftContract = RWA(_rwaNftContractAddress);
        erc6551Registry = IERC6551Registry(_erc6551RegistryAddress);
        rwaGovernorLogic = _rwaGovernorLogicAddress;
        daoTreasury = _daoTreasuryAddress;
    }

    function votingDelay() public pure override returns (uint256) { return 0; }
    function votingPeriod() public pure override returns (uint256) { return 120; }
    function proposalThreshold() public pure override returns (uint256) { return 0; }

    // ... (rest of the DAO functions: createRWAFundingProposal, invest, etc.) ...
    // ... (No changes needed in the middle of the contract) ...


    function _executeSuccess(uint256 proposalId) internal {
        RWAProposal storage proposal = rwaProposals[proposalId];
        require(proposal.state == RWAProposalState.Funding, "Proposal not funding");
        
        proposal.state = RWAProposalState.Succeeded;

        // Mint RWA NFT to DAO Treasury
        uint256 newNftId = rwaNftContract.mint(daoTreasury, proposal.nftMetadataURI);
        // Connect newly minted NFT ID with the proposal ID
        nftProposalId[newNftId] = proposalId;

        // --- KLJUČNA IZMENA OVDJE ---
        // Transfer all raised USDC to the PROPOSER (the musician)
        uint256 totalRaised = proposal.raisedUSDC;
        
        // STARI KOD:
        // require(usdcToken.transfer(daoTreasury, totalRaised), "USDC transfer failed");
        
        // NOVI KOD:
        require(usdcToken.transfer(proposal.proposer, totalRaised), "USDC transfer failed");
        // --- KRAJ IZMENE ---


        // Mint GOV tokene in the DAO treasury based on USDC raised
        uint256 govEquivalentTotal = totalRaised * (10 ** (18 - 6));
        // FIX: Cast token() to address, then to GovToken
        GovToken(address(token())).mint(daoTreasury, govEquivalentTotal);

        // Remmember shares for each investor
        for (uint256 i = 0; i < proposal.investorList.length; i++) {
            address investor = proposal.investorList[i];
            uint256 usdcInvested = proposal.investors[investor];
            if (usdcInvested > 0) {
                uint256 shareEquivalent = usdcInvested * (10 ** (18 - 6));
                rwaShares[newNftId][investor] = shareEquivalent;
            }
        }

        // Deploy RWAGovernor and TBA for this RWA NFT
        _deployRWAGovernor(newNftId);
        proposal.state = RWAProposalState.Executed;
        emit ProposalFinalized(proposalId, RWAProposalState.Executed);
    }

    // Function to deploy RWAGovernor and TBA for a given NFT ID
    function _deployRWAGovernor(uint256 nftId) internal {
        // Create the TBA (wallet) for the NFT
        address tbaImplementation = 0x0000000000000000000000000000000000006551;
        bytes32 salt;
        // Inline assembly keccak256 for slight gas optimization per warning (optional)
        assembly {
            // store nftId and chainid contiguously in memory
            let ptr := mload(0x40)
            mstore(ptr, nftId)
            mstore(add(ptr, 0x20), chainid())
            salt := keccak256(ptr, 0x40)
        }

        address tbaAddress = erc6551Registry.createAccount(
            tbaImplementation,
            salt,
            block.chainid,
            address(rwaNftContract),
            nftId
        );
        // Deploy the RWAGovernor proxy
        address newGovernor = Clones.clone(rwaGovernorLogic);
        // Initialize the RWAGovernor
        
        // FIX: Cast newGovernor to payable
        RWAGovernor(payable(newGovernor)).initialize(
            nftId, 
            tbaAddress, // wallet address
            payable(address(this)) // Address of this DAO (as the 'provider' of votes)
        );
        // Save the address of the new DAO ("brain")
        rwaDaos[nftId] = newGovernor;
        isRWAGovernor[newGovernor] = true;

        // Attempt to transfer ownership of the wallet (TBA) to RWAGovernor if the implementation is Ownable.
        // Many ERC-6551 reference accounts are not Ownable and derive authority from the NFT owner instead.
        // If the TBA is not Ownable, this call will revert and be safely ignored here; ensure your TBA
        // implementation authorizes RWAGovernor to execute (e.g., via custom validator/controller logic).
        try Ownable(tbaAddress).transferOwnership(newGovernor) {
            // Ownership transferred successfully on Ownable-compatible TBA implementations.
        } catch {
            // Non-Ownable TBA: no action. RWAGovernor must be authorized by the TBA's own rules.
        }
        emit RWADeployed(nftId, newGovernor, tbaAddress);
    }

    // --- RWA Funding flow ---

    function createRWAFundingProposal(uint256 _targetUSDC, string memory _nftMetadataURI) public {
        uint256 id = nextRWAProposalId;
        nextRWAProposalId = id + 1;

        RWAProposal storage p = rwaProposals[id];
        p.id = id;
        p.proposer = msg.sender;
        p.targetUSDC = _targetUSDC;
        p.raisedUSDC = 0;
        p.deadline = block.timestamp + RWA_FUNDING_PERIOD;
        p.nftMetadataURI = _nftMetadataURI;
        p.state = RWAProposalState.Funding;

        emit RWAFundingProposalCreated(id, msg.sender, _targetUSDC, p.deadline);
    }

    function invest(uint256 proposalId, uint256 amount) public {
        RWAProposal storage p = rwaProposals[proposalId];
        require(p.state == RWAProposalState.Funding, "Not funding");
        require(block.timestamp < p.deadline, "Deadline passed");
        require(amount > 0, "Amount zero");

        require(usdcToken.transferFrom(msg.sender, address(this), amount), "transferFrom failed");

        // Add investor if first time
        if (p.investors[msg.sender] == 0) {
            p.investorList.push(msg.sender);
        }

        p.investors[msg.sender] += amount;
        p.raisedUSDC += amount;

        emit Invested(proposalId, msg.sender, amount);
    }

    function finalizeProposal(uint256 proposalId) public {
        RWAProposal storage p = rwaProposals[proposalId];
        require(block.timestamp >= p.deadline, "Too early");
        require(p.state == RWAProposalState.Funding, "Already finalized");

        if (p.raisedUSDC >= p.targetUSDC) {
            _executeSuccess(proposalId);
        } else {
            p.state = RWAProposalState.Failed;
            emit ProposalFinalized(proposalId, RWAProposalState.Failed);
        }
    }

    function reclaimInvestment(uint256 proposalId) public {
        RWAProposal storage p = rwaProposals[proposalId];
        require(p.state == RWAProposalState.Failed, "Not failed");
        uint256 amt = p.investors[msg.sender];
        require(amt > 0, "Nothing to reclaim");
        p.investors[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, amt), "USDC transfer failed");
        emit InvestmentReclaimed(proposalId, msg.sender, amt);
    }


    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }
    
    /**
     * @dev Returns the list of investors for a given RWA proposal.
     */
    function getInvestorList(uint256 proposalId) external view returns (address[] memory) {
        return rwaProposals[proposalId].investorList;
    }

    function clock() public view virtual override(Governor, GovernorVotes) returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public view virtual override(Governor, GovernorVotes) returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @dev Helper za kreiranje predloga za promenu metadata na RWA NFT-u.
     * @param rwaNftAddress Adresa RWA.sol ugovora.
     * @param nftId ID tokena koji se menja.
     * @param newURI Novi metadata URI.
     * @param description Opis predloga.
     */
    function proposeNFTMetadataChange(
        address rwaNftAddress,
        uint256 nftId,
        string memory newURI,
        string memory description
    ) external returns (uint256 proposalId) {
        
        bytes memory calldataSetURI = abi.encodeWithSignature(
            "setTokenURI(uint256,string)",
            nftId,
            newURI
        );

        address[] memory targets = new address[](1);
        targets[0] = rwaNftAddress;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = calldataSetURI;

        // Poziva propose() funkciju samog DAO ugovora
        // Ovde se glasa GOV tokenima
        return this.propose(targets, values, calldatas, description);
    }
}