# Melody Bond - RWA DAO Frontend

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

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- A wallet (MetaMask, Coinbase Wallet, etc.)
- Sepolia ETH for non-gasless transactions
- USDC on Sepolia for investing

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
# Contract Addresses (Sepolia)
NEXT_PUBLIC_DAO_ADDRESS=0x93793508d9Aa1B6ECf6E92B470d8daB0D32BaC91
NEXT_PUBLIC_GOVTOKEN_ADDRESS=0x5a679bDB706EBd1dCD8225A3F8b28C78e69D0CbF
NEXT_PUBLIC_TIMELOCK_ADDRESS=0xf5c56f3e66A59B8D5A7A1A6b2AC2e7e2c5F4e9E2
NEXT_PUBLIC_RWA_NFT_ADDRESS=0x3D01e38F75f5B82b48A878C25c4F1d1c5a2F9E0a
NEXT_PUBLIC_RWAGOVERNOR_LOGIC_ADDRESS=0xBac5f8d7C1C8B5c4e2F1d0c9b8a7e6d5c4b3a2e1
NEXT_PUBLIC_DISTRIBUTOR_ADDRESS=0xC7d4e9F2a1b0c9e8d7f6e5d4c3b2a1f0e9d8c7b6
NEXT_PUBLIC_VOTING_PAYMASTER_ADDRESS=0xD3b84c0C5c5c46f38ea00417a7b64285F1A72849
NEXT_PUBLIC_DAO_TREASURY_ADDRESS=0xE4f5d1c0b9a8e7f6d5e4c3b2a1f0e9d8c7b6a5d4
NEXT_PUBLIC_USDC_ADDRESS=0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
NEXT_PUBLIC_ENTRYPOINT=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
NEXT_PUBLIC_ERC6551_REGISTRY_ADDRESS=0x000000006551c19487814612e58FE06813775758

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CHAIN_NAME=Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_BUNDLER_URL=https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_PIMLICO_KEY

# Privy (Wallet Connection)
NEXT_PUBLIC_PRIVY_APP_ID=YOUR_PRIVY_APP_ID
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 User Guide

### For Investors

1. **Connect Wallet**: Click "Connect Wallet" in the header
2. **View Projects**: Go to `/projects` to see funding opportunities
3. **Invest**: 
   - Approve USDC spending (one-time)
   - Enter investment amount
   - Click "Invest (Gasless)" - no gas fees!
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

## 🏗️ Architecture

### Smart Contracts
- **DAO**: Main factory contract, creates RWA proposals, manages investments
- **RWAGovernor**: Per-NFT governance contract (cloned for each successful proposal)
- **GovToken**: ERC20Votes governance token for main DAO
- **RWA**: ERC721 NFT representing RWA ownership
- **VotingPaymaster**: ERC-4337 paymaster sponsoring gasless transactions
- **Distributor**: Revenue distribution based on investment shares

### Account Abstraction Flow
1. User initiates action (invest/vote)
2. Frontend builds ERC-4337 UserOperation
3. Calls Pimlico API to sponsor transaction (`pm_sponsorUserOperation`)
4. Pimlico returns `paymasterAndData`
5. UserOp submitted to bundler (`eth_sendUserOperation`)
6. Bundler executes on-chain, paymaster covers gas

### Data Flow
```
User Wallet → viem/wagmi → Pimlico Bundler → EntryPoint → VotingPaymaster → DAO/RWAGovernor
```

## 🧪 Testing

### Test Gasless Invest
1. Get Sepolia USDC from faucet
2. Go to `/projects`
3. Create or find a proposal
4. Click "Invest (Gasless)"
5. Sign message (no ETH needed!)

### Test Gasless Vote
1. After investing, go to `/governance`
2. Find your RWA in "My RWA Governors" tab
3. Click vote button
4. Sign message (no ETH needed!)

## 🔧 Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **viem**: Ethereum library
- **wagmi**: React hooks for Ethereum
- **Privy**: Wallet connection
- **Pimlico**: Account abstraction bundler
- **Tailwind CSS**: Styling

## 📝 Key Files

- `src/lib/accountAbstraction.ts`: ERC-4337 UserOp builder
- `src/lib/clients.ts`: viem client configuration
- `src/contracts/index.ts`: Contract ABIs and addresses
- `src/app/projects/page.tsx`: Funding proposals UI
- `src/app/governance/page.tsx`: Voting UI
- `src/app/portfolio/page.tsx`: Investment portfolio
- `src/app/admin/page.tsx`: Paymaster management

## 🐛 Troubleshooting

### "Insufficient paymaster balance"
- Admin needs to fund paymaster at `/admin`

### "Approval needed"
- First-time investors must approve USDC spending
- Frontend will prompt automatically

### "Transaction failed"
- Check Sepolia block explorer for details
- Ensure paymaster has sufficient ETH
- Verify contract addresses in `.env.local`

### "Metadata not loading"
- Check IPFS/image URLs in proposal metadata
- Fallback placeholder will be used

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Environment Variables
Add all `.env.local` variables to Vercel project settings

## 📄 License

MIT
