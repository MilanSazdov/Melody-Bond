# RWA Portfolio & Governance System

This system allows investors in Real World Asset (RWA) NFTs to:
1. View their investments in a portfolio
2. Create governance proposals for their RWAs
3. Vote on proposals with weighted voting based on their investment shares

## Architecture

### Smart Contracts (Backend)

- **DAO.sol**: Main DAO contract managing RWA funding proposals and tracking investor shares
- **RWA.sol**: ERC721 NFT contract for RWA tokens
- **RWAGovernor.sol**: Governance contract for each individual RWA NFT (deployed via clones)
- **Distributor.sol**: Helper contract for distributing funds from TBA wallets to investors
- **ERC-6551 (TBA)**: Token Bound Account wallet for each RWA NFT

### Frontend Components

- **/portfolio** - Portfolio page showing all RWA investments
- **/governance** - Governance page showing RWA-specific proposals
- **RWAVote.tsx** - Weighted voting component for RWA proposals

## How It Works

### 1. Investment Flow

1. User invests USDC in an RWA funding proposal via DAO contract
2. When proposal succeeds, an RWA NFT is minted
3. Investor shares are recorded: `rwaShares[nftId][investor] = shareAmount`
4. An ERC-6551 TBA wallet is created for the NFT
5. An RWAGovernor contract (clone) is deployed to govern the RWA

### 2. Portfolio View

The portfolio page displays:
- All RWA NFTs the user has invested in
- User's share amount for each NFT
- TBA balance for each RWA
- Quick access to propose and view governance

**Key Functions:**
- `getUserRWAInvestments()` - Fetches all RWAs where user has shares > 0
- `getTBABalance()` - Gets the USDC balance in each TBA wallet

### 3. Creating Proposals

Investors can create three types of proposals:

#### A. Change Name/Metadata
- Updates the NFT's tokenURI
- Useful for rebranding or updating project information
- Calls `RWA.setTokenURI(nftId, newURI)`

#### B. Change Image
- Updates the NFT's image via new metadata URI
- Similar to change name but focused on visual assets
- Calls `RWA.setTokenURI(nftId, newURI)`

#### C. Withdraw Funds (Distribution)
- Distributes funds from TBA wallet to all investors proportionally
- Two-step process:
  1. TBA approves Distributor to spend tokens
  2. TBA calls `Distributor.distribute(nftId, amount, tokenAddress)`
- Distributor calculates each investor's share and transfers accordingly

**Key Functions:**
- `buildChangeNameProposal()` - Creates change name proposal data
- `buildChangeImageProposal()` - Creates change image proposal data
- `buildWithdrawProposal()` - Creates withdrawal/distribution proposal data

### 4. Weighted Voting

Voting power is determined by investor shares:
- Shares are based on USDC invested (converted to 18 decimals)
- Each investor's voting power = their shares for that specific NFT
- RWAGovernor reads voting power from `DAO.rwaShares(nftId, voter)`
- Votes are weighted automatically by the contract

**Voting Process:**
1. User casts vote (For/Against/Abstain) on active proposal
2. RWAGovernor checks `rwaShares[nftId][voter]` for voting power
3. Vote is recorded with user's share weight
4. When voting ends, proposal succeeds if enough weighted votes

**Key Functions:**
- `getUserVotingPower()` - Gets user's voting power for an RWA
- `hasUserVoted()` - Checks if user already voted on proposal
- `getRWAProposals()` - Fetches all proposals for an RWA Governor

### 5. Proposal Execution

When a proposal succeeds:
- Anyone can execute the proposal
- RWAGovernor instructs the TBA wallet to perform actions
- For withdrawals: funds are distributed via Distributor contract
- For metadata changes: NFT tokenURI is updated

## Smart Contract Addresses (Sepolia)

```
DAO: 0x132AD6fB8EaF3065C831Febf5788AbDa4B72c76C
GovToken: 0xb0231d9dC68C4C320d121237fE8De00ab5899dBE
Timelock: 0x417875AD8Af4DE85325DC1Ea09A719ea16254dDD
RWA NFT: 0x914c81B1A6C3aCF7B5903a7EDcB53C59373C6B57
RWA Governor Logic: 0x6a5Fb4851aEB873641768e7996b8112766a50FC7
Distributor: 0xdD504aE23C6C63Ee60Ffc7abd84F736BC9b601f9
MockUSDC: 0x49379c59Da9D2472896B37B8Cd86EA0B1CB256E9
```

## Data Flow

```
User Investment (USDC)
    ↓
DAO.invest() records shares
    ↓
RWA NFT Minted + TBA Created
    ↓
RWAGovernor Deployed (clone)
    ↓
Investor can propose & vote
    ↓
Votes weighted by shares
    ↓
Proposal executes via TBA
    ↓
Funds distributed proportionally
```

## Key Features

✅ **Weighted Voting**: Votes are automatically weighted by investment shares
✅ **Token Bound Accounts**: Each RWA has its own wallet (TBA)
✅ **Proportional Distribution**: Withdrawals are distributed based on ownership
✅ **Flexible Governance**: Three proposal types with more extensible
✅ **Investor Protection**: Only investors can propose, all can vote
✅ **Gas Sponsorship**: Can use VotingPaymaster for gasless voting

## Development

### Running Locally

1. Update contract addresses in `.env.local`
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Navigate to `/portfolio` to view investments
4. Navigate to `/governance` to view and vote on proposals

### Testing the Flow

1. **Invest in RWA**: Go to `/projects` and invest in a funding proposal
2. **View Portfolio**: Go to `/portfolio` to see your investments
3. **Create Proposal**: Click "Propose" on an RWA and select proposal type
4. **Vote**: Go to `/governance` or `/governance?nft=X` to vote
5. **Execute**: When proposal succeeds, execute it to apply changes

## Technical Notes

- **Share Conversion**: USDC (6 decimals) → Shares (18 decimals)
  - 1 USDC = 10^12 shares
- **Vote Counting**: Uses OpenZeppelin's GovernorCountingSimple
- **TBA Authorization**: RWAGovernor must be authorized to control TBA
- **Proposal Threshold**: Set to 0 (any investor can propose)
- **Quorum**: Set to 0 (no minimum votes required)
- **Voting Period**: 120 blocks (~10 minutes on Sepolia)

## Security Considerations

⚠️ **Important**: This is a demo system. Production deployments should:
- Add proposal thresholds (minimum shares to propose)
- Implement proper quorum requirements
- Add timelock delays for execution
- Audit all smart contracts
- Implement access controls
- Add emergency pause functionality
- Consider vote delegation mechanics

## Future Enhancements

- [ ] Add vote delegation for RWA shares
- [ ] Implement proposal cancellation
- [ ] Add more proposal types (e.g., change controller)
- [ ] Support multiple token types in TBA
- [ ] Add proposal discussion/comments
- [ ] Implement notification system
- [ ] Add historical voting records
- [ ] Support off-chain voting (Snapshot)
