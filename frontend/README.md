# Melody Bond - RWA DAO Frontend

This README documents the frontend application only. It explains how to run and configure the frontend and which contract addresses the frontend expects. It does not include smart contract source, deployment scripts, or deployment guides — see the repository root or contract directories for those details.

Decentralized governance platform for Real World Asset (RWA) tokenization with gasless transactions via Pimlico bundler on Sepolia testnet.

## 🚀 Features

### ✅ Gasless Transactions (ERC-4337)
- **Gasless Investing**: Invest in RWA funding proposals without paying gas
- **Gasless Voting**: Vote on DAO and RWA Governor proposals without gas fees
- **Pimlico Bundler**: Powered by Pimlico's account abstraction infrastructure

### 📊 Four Main Sections

#### 1. **Projects** (`/projects`)
- View all active RWA funding proposals
- Create new funding proposals with metadata
- Invest in proposals using gasless transactions
- Track funding progress with visual progress bars
- Finalize proposals when deadline is reached
- Reclaim investments from failed proposals

#### 2. **Governance** (`/governance`)
- **Main DAO Tab**: Vote on main DAO proposals with GOV token voting power
- **RWA Governors Tab**: Vote on proposals for specific RWA projects you've invested in
- All votes are gasless (sponsored by VotingPaymaster)
- Real-time proposal state and vote counts

#### 3. **Portfolio** (`/portfolio`)
- View all your RWA investments
- See your voting shares and USDC equivalent
- Monitor TBA (Token Bound Account) balances
- Send revenue to TBA wallets
- Create withdrawal proposals (coming soon)

#### 4. **Admin** (`/admin`)
- Monitor VotingPaymaster balance in EntryPoint contract
- Fund paymaster with ETH to enable gasless transactions
- View sponsored function signatures

## 🛠️ Setup (Frontend)

### Prerequisites
- Node.js 18+
- A wallet (MetaMask, Coinbase Wallet, etc.)
- Sepolia ETH for non-gasless transactions (when needed)
- USDC on Sepolia for investing (mock or testnet USDC)

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values. The addresses below are the frontend configuration defaults (Sepolia):

```env
# Contract Addresses (Sepolia) - frontend configuration
NEXT_PUBLIC_DAO_ADDRESS=0xd4E82Da26f771698a506aab4eAC056665268e857            # DAO
NEXT_PUBLIC_GOVTOKEN_ADDRESS=0x2F5Efd038D0015F400FA12D36197C61B2F909c1d       # GovToken
NEXT_PUBLIC_TIMELOCK_ADDRESS=0x4443C7b91b59c553f3aD488bff68F97D802B279F       # MainTimelock
NEXT_PUBLIC_RWA_NFT_ADDRESS=0xd757e4e7ae631a558c74382aE77C1546313E6016        # RwaNFT
NEXT_PUBLIC_RWAGOVERNOR_LOGIC_ADDRESS=0xC797D7520f0AdBAEe7f4641F5AFa88A623fF354a  # RwaGovernorLogic
NEXT_PUBLIC_DISTRIBUTOR_ADDRESS=0x4744C6D6749Af15eaCCf3c36ECec8e045a4B3afa   # Distributor
NEXT_PUBLIC_VOTING_PAYMASTER_ADDRESS=0xb49bD1a56B9A8310f5e05026b51D792ab1A79871 # VotingPaymaster
NEXT_PUBLIC_DAO_TREASURY_ADDRESS=0xf7bB047581E3B6FD5B2c744a533Abd1846ED09Ee   # TreasuryDeployer (frontend treas config)
NEXT_PUBLIC_USDC_ADDRESS=0x1eA31CD06D5D86C9752e81e93764967a662De589       # MockUSDC
NEXT_PUBLIC_ENTRYPOINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789           # EntryPoint (Sepolia)
NEXT_PUBLIC_ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CHAIN_NAME=Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_BUNDLER_URL=https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_PIMLICO_KEY

# Privy (Wallet Connection)
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_PRIVY_APP_ID
```

> Note: Replace the RPC and Pimlico API keys and PRIVY app id with your own. The addresses above are the values the frontend is configured to use by default.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 User Guide (Frontend)

### For Investors

1. **Connect Wallet**: Click "Connect Wallet" in the header
2. **View Projects**: Go to `/projects` to see funding opportunities
3. **Invest**: 
   - Approve USDC spending (one-time)
   - Enter investment amount
   - Click "Invest (Gasless)" - no gas fees when paymaster is funded
4. **Track Portfolio**: View your investments in `/portfolio`
5. **Vote on Governance**: Go to `/governance` to vote on RWA proposals

### For Project Creators

1. **Create Proposal**: On `/projects`, click "Create New RWA Proposal"
2. **Fill Details**:
   - Target funding amount in USDC
   - Project name and description
   - Optional image URL
3. **Wait for Funding**: Share with investors
4. **Finalize**: After deadline, click "Finalize Proposal"
   - If target met: NFT minted, RWA Governor deployed
   - If target not met: Investors can reclaim funds

### For Administrators

1. **Monitor Paymaster**: Go to `/admin`
2. **Check Balance**: View ETH balance in EntryPoint
3. **Fund Paymaster**: Send ETH to enable gasless transactions
4. **Minimum Recommended**: 0.1 ETH for testing

## 🏗️ Frontend Architecture Overview

The frontend interacts with the smart contracts listed in the environment variables above. It handles:
- Building ERC-4337 UserOperations for gasless interactions
- Calling Pimlico bundler to sponsor UserOperations
- Interacting with the DAO, GovToken, RWA NFT, paymaster, and distributor contracts for UI flows

### Key Frontend Files
- src/lib/accountAbstraction.ts — ERC-4337 UserOp builder
- src/lib/clients.ts — viem/wagmi client configuration
- src/contracts/index.ts — contract ABIs and addresses used by the frontend
- src/app/projects/page.tsx — Funding proposals UI
- src/app/governance/page.tsx — Voting UI
- src/app/portfolio/page.tsx — Investment portfolio
- src/app/admin/page.tsx — Paymaster management

## 🧪 Testing (Frontend)

### Test Gasless Invest
1. Get Sepolia USDC from faucet (mock USDC above)
2. Go to `/projects`
3. Create or find a proposal
4. Click "Invest (Gasless)"
5. Sign message (no ETH needed if paymaster is funded)

### Test Gasless Vote
1. After investing, go to `/governance`
2. Find your RWA in "My RWA Governors" tab
3. Click vote button
4. Sign message (no ETH needed if paymaster is funded)

## 🔧 Tech Stack

- Next.js 14: React framework with App Router
- TypeScript: Type-safe development
- viem: Ethereum library
- wagmi: React hooks for Ethereum
- Privy: Wallet connection
- Pimlico: Account abstraction bundler
- Tailwind CSS: Styling

## 🚀 Deployment (Frontend)

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Environment Variables
Add all `.env.local` variables from above to Vercel project settings.

## 📄 Misc / Notes

- Deployment block (DAO): 9595342 — used by the frontend for event indexing if needed.
- This README is focused on the frontend application only. For smart contract sources, deployment scripts, and audit notes, consult the contracts folder or repository root.

## 📄 License

MIT
```
