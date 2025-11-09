# 🚀 Quick Start Guide - RWA Portfolio & Governance

## Prerequisites
- Node.js installed
- MetaMask or compatible wallet
- Sepolia testnet ETH and USDC

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open in Browser
Navigate to: `http://localhost:3000`

---

## Testing the Features

### 📊 Portfolio Page
**URL:** `/portfolio`

**What to Test:**
1. Connect your wallet
2. View all RWAs you've invested in
3. Check your share amounts
4. Check TBA balances for each RWA

**Expected Result:**
- See cards for each RWA investment
- Display your shares (in 18 decimals)
- Show USDC balance in TBA wallet
- "Propose" and "View Proposals" buttons

---

### 💡 Creating Proposals

**Steps:**
1. Go to `/portfolio`
2. Click **"Propose"** on any RWA card
3. Select proposal type:

#### Option 1: Change Name/Metadata
- Enter new metadata URI (e.g., `ipfs://Qm...` or `https://...`)
- Click "Create Proposal"
- Approve transaction in wallet

#### Option 2: Change Image
- Enter new metadata URI with updated image
- Click "Create Proposal"
- Approve transaction in wallet

#### Option 3: Withdraw Funds
- Enter amount in USDC (e.g., `100`)
- Click "Create Proposal"
- Approve transaction in wallet

**Expected Result:**
- Transaction confirmed
- Proposal appears in governance page
- You can vote on it

---

### 🗳️ Voting on Proposals

**URL:** `/governance` or `/governance?nft=X`

**Steps:**
1. Navigate to governance page
2. Find proposals for RWAs you invested in
3. Review proposal details
4. Check your voting power (shares)
5. Click **"For"**, **"Against"**, or **"Abstain"**
6. Approve transaction in wallet

**Expected Result:**
- Vote recorded with your share weight
- Vote distribution updates
- Can only vote once per proposal
- Voting disabled after voting or when inactive

---

### 💰 Withdrawal Distribution (Most Important!)

**Complete Flow:**

#### Step 1: Create Withdrawal Proposal
```
Portfolio -> Select RWA -> Propose -> Withdraw Funds
Enter amount: 100 USDC
Submit transaction
```

#### Step 2: Vote on Proposal
```
Governance -> Find withdrawal proposal -> Vote For
Wait for other investors to vote
```

#### Step 3: Execute Proposal
```
After voting period ends (120 blocks)
Anyone can execute the proposal
Funds automatically distributed!
```

#### What Happens:
```
TBA Wallet (1000 USDC)
    ↓ Withdrawal Proposal (1000 USDC)
    ↓ Distributor calculates shares
    ↓
Alice (60% shares) receives → 600 USDC
Bob (40% shares) receives   → 400 USDC
```

**Expected Result:**
- Each investor receives USDC proportional to their shares
- Check your wallet balance to confirm
- TBA balance reduced by withdrawal amount

---

## 🔍 Verification Checklist

### ✅ Portfolio Page
- [ ] Shows all your RWA investments
- [ ] Displays correct share amounts
- [ ] Shows TBA balances
- [ ] "Propose" button works
- [ ] Redirects to governance page

### ✅ Proposal Creation
- [ ] All three proposal types available
- [ ] Forms validate input correctly
- [ ] Transactions confirm successfully
- [ ] Proposals appear in governance

### ✅ Weighted Voting
- [ ] Voting power equals your shares
- [ ] Can vote For/Against/Abstain
- [ ] Can only vote once per proposal
- [ ] Vote distribution updates correctly
- [ ] Percentages calculated correctly

### ✅ Withdrawal Distribution
- [ ] Proposal created with correct amount
- [ ] Voting works normally
- [ ] Execution distributes funds
- [ ] Each investor receives correct proportion
- [ ] TBA balance updates

---

## 📝 Test Scenario (Complete Example)

### Scenario: Two Investors Withdraw Profits

**Initial State:**
- RWA NFT #0 exists
- Alice invested 600 USDC (60% shares)
- Bob invested 400 USDC (40% shares)
- TBA wallet has 1000 USDC profit

**Steps:**

1. **Alice Creates Withdrawal Proposal**
   ```
   Go to /portfolio
   Click "Propose" on RWA #0
   Select "Withdraw Funds"
   Enter: 1000 USDC
   Submit transaction
   ```

2. **Both Vote**
   ```
   Alice: Go to /governance, vote FOR (600 vote weight)
   Bob: Go to /governance, vote FOR (400 vote weight)
   Total FOR votes: 1000
   ```

3. **Proposal Passes and Executes**
   ```
   After 120 blocks (~10 min)
   Anyone executes the proposal
   Distributor calculates:
   - Alice gets: (1000 × 600) / 1000 = 600 USDC
   - Bob gets: (1000 × 400) / 1000 = 400 USDC
   ```

4. **Verify Results**
   ```
   Check Alice's wallet: +600 USDC ✓
   Check Bob's wallet: +400 USDC ✓
   Check TBA balance: 0 USDC ✓
   ```

---

## 🛠️ Troubleshooting

### Issue: Portfolio is Empty
**Solution:**
- Make sure you've invested in an RWA
- Check that the proposal has been finalized
- Verify your wallet address matches

### Issue: Can't Create Proposal
**Solution:**
- Ensure you have shares in that RWA
- Check that you're connected with correct wallet
- Verify contract addresses in .env.local

### Issue: Voting Doesn't Work
**Solution:**
- Check if proposal is in Active state
- Ensure you haven't voted already
- Verify you have shares in that specific RWA

### Issue: Withdrawal Not Distributing
**Solution:**
- Ensure proposal has succeeded and executed
- Check TBA has sufficient balance
- Verify Distributor contract address
- Check that TBA approved Distributor

---

## 📞 Contract Interaction Examples

### Get Your Shares
```typescript
// Read from DAO contract
const shares = await publicClient.readContract({
  address: DAO_ADDRESS,
  abi: DAO_ABI,
  functionName: 'rwaShares',
  args: [nftId, userAddress],
})
```

### Get TBA Balance
```typescript
// Read from USDC contract
const balance = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: [tbaAddress],
})
```

### Vote on Proposal
```typescript
// Write to RWAGovernor contract
const hash = await walletClient.writeContract({
  address: governorAddress,
  abi: RWA_GOVERNOR_ABI,
  functionName: 'castVote',
  args: [proposalId, voteSupport], // 0=Against, 1=For, 2=Abstain
})
```

---

## 🎯 Success Criteria

Your system is working correctly if:

1. ✅ Portfolio shows all your RWA investments
2. ✅ You can create all three proposal types
3. ✅ Voting weight equals your shares
4. ✅ Vote distribution displays correctly
5. ✅ Withdrawals distribute funds proportionally
6. ✅ All transactions confirm on blockchain
7. ✅ UI updates in real-time

---

## 🎊 You're Ready!

Once all tests pass, your RWA portfolio and governance system is fully operational!

**Next Steps:**
- Test with real users
- Monitor gas costs
- Consider adding more proposal types
- Implement notifications
- Add proposal discussion features

**Need More Info?**
- See `IMPLEMENTATION_SUMMARY.md` for complete overview
- See `RWA_PORTFOLIO_README.md` for technical details
- Check inline code comments for specifics

**Happy testing! 🚀**
