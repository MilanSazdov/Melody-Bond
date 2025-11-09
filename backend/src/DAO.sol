// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol"; 
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


import "./RWA.sol";
import "./interfaces/IERC6551.sol";
import "./RWAGovernor.sol";
import "./GovToken.sol";

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
    function votingPeriod() public pure override returns (uint256) { return 10; }
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
        // Transfer all raised USDC to DAO treasury
        uint256 totalRaised = proposal.raisedUSDC;
        usdcToken.transfer(daoTreasury, totalRaised);

        // Mint GOV tokene in the DAO treasury based on USDC raised
        uint256 govEquivalentTotal = totalRaised * (10 ** (18 - 6));
        
        // FIX: Cast token() to address, then to GovToken
        GovToken(address(token())).mint(daoTreasury, govEquivalentTotal);

        // Remmember shares for each investor
        for (uint i = 0; i < proposal.investorList.length; i++) {
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
        bytes32 salt = keccak256(abi.encodePacked(nftId, block.chainid));

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

        // Transfer ownership of the wallet (TBA) to RWAGovernor
        Ownable(tbaAddress).transferOwnership(newGovernor);
        emit RWADeployed(nftId, newGovernor, tbaAddress);
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
}