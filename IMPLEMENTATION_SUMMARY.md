# 🎵 Melody Bond – RWA Portfolio & Governance Platform

A full-stack Real-World Asset (RWA) investment and governance system featuring:

- Per-asset (per-NFT) decentralized governance
- Weighted, share-based voting
- Token Bound Accounts (TBA) as per-asset treasuries
- Automated proportional fund distribution
- Investor portfolio dashboard
- Proposal lifecycle (metadata updates & withdrawals)
- Foundry-based smart contract development + Next.js frontend

---

## 📚 Table of Contents

1. Overview
2. Architecture
3. Core Concepts
4. Features
5. Smart Contracts (Foundry)
6. Frontend (Next.js)
7. Governance Flows
8. Withdrawal Flow (Detailed)
9. Addresses & Deployment
10. Development (Contracts & Frontend)
11. Testing Scenarios
12. Future Enhancements
13. Security Considerations
14. FAQ

---

## 1. 🔍 Overview

Melody Bond enables fractional participation in RWAs where each successful funding proposal mints an NFT representing the asset. Each NFT automatically gets:

- A Token Bound Account (TBA) (its treasury)
- A dedicated RWAGovernor (asset-level DAO)
- Share accounting via the main DAO contract (`rwaShares`)

Investors can:
- View their positions in a Portfolio page
- Propose: change metadata, change image, withdraw funds
- Vote with weight = their shares
- Execute successful proposals
- Receive proportional distributions

---

## 2. 🏗️ Architecture

```
Frontend (Next.js / wagmi / ethers)
        │
        │ JSON-RPC (Alchemy / Infura / etc.)
        ▼
On-Chain Contracts
  ├─ DAO (core registry, share ledger, investment logic)
  ├─ RWAGovernor (clone per RWA NFT)
  ├─ Timelock (optional main governance control)
  ├─ RWA NFT (each funded project)
  ├─ Distributor (proportional payout engine)
  ├─ GovToken (if main governance token needed)
  ├─ VotingPaymaster (gasless voting support)
  └─ MockUSDC (test stablecoin)
        │
        ▼
Token Bound Accounts (one per NFT)
  └─ Holds funds & executes proposal actions
```

---

## 3. 🧠 Core Concepts

| Concept | Description |
|---------|-------------|
| Shares | Recorded in `DAO.rwaShares[nftId][user]` (18 decimals). 1 USDC invested → scaled to 10^12 shares. |
| Voting Power | Equal to user shares for that NFT. No delegation required. |
| TBA | Wallet bound to an NFT; holds capital or yield; executes proposal actions. |
| RWAGovernor | Minimal clone per NFT; executes proposals via the TBA. |
| Distributor | Handles proportional USDC distribution to investors. |
| Proposal Types | Change Name/Metadata, Change Image (both via `setTokenURI`), Withdraw Funds. |

---

## 4. ✅ Features

### Portfolio
- Lists all RWAs where user share balance > 0
- Displays: NFT info, user shares, TBA USDC balance
- Quick actions: Propose, View Governance

### Governance
- Weighted voting (For / Against / Abstain)
- Prevents double voting
- Shows distribution progress bars
- Gasless voting supported

### Proposals
1. Change Name / Metadata (updates tokenURI)
2. Change Image (also tokenURI-focused)
3. Withdraw Funds (Distributor flow)

### Withdrawals
- Two batched actions (approve + distribute)
- Fully proportional based on shares

---

## 5. 🧪 Smart Contracts (Foundry)

Smart contracts are built and tested with [Foundry](https://book.getfoundry.sh/).

### Foundry Toolkit

- Forge: Testing & scripting
- Cast: CLI interactions
- Anvil: Local Ethereum node
- Chisel: Solidity REPL

### Common Commands

```bash
forge build                # Compile contracts
forge test                 # Run test suite
forge snapshot             # Gas snapshots
forge fmt                  # Format sources
anvil                      # Local dev chain
cast <subcommand>          # Chain & contract utilities
forge script script/Deploy.s.sol:Deploy --rpc-url <rpc> --private-key <pk>
```

Add `.env` with RPC + private key for scripts if required.

### Suggested Directory Structure (example)
```
contracts/
  DAO.sol
  RWAGovernor.sol
  RWA.sol
  Distributor.sol
  VotingPaymaster.sol
  MockUSDC.sol
script/
  Deploy.s.sol
  CreateRWA.s.sol
test/
  DAO.t.sol
  Governance.t.sol
  Withdraw.t.sol
```

---

## 6. 💻 Frontend (Next.js)

Key Files:
- `frontend/src/app/portfolio/page.tsx` – Portfolio dashboard
- `frontend/src/app/governance/page.tsx` – Governance UI (extended)
- `frontend/src/components/RWAVote.tsx` – Weighted voting UI
- `frontend/src/lib/rwaGovernance.ts` – Governance helper library
- `frontend/src/constants.ts` – Addresses & ABIs

Run Dev:
```bash
cd frontend
npm install
npm run dev
```

---

## 7. 🔄 Governance Flows

1. Invest in funding proposal (USDC)
2. NFT minted + TBA + RWAGovernor deployed
3. Shares recorded
4. User proposes (metadata / image / withdraw)
5. Voting (share-weighted)
6. Execution via RWAGovernor → TBA call bundle
7. (If withdrawal) Distributor distributes

---

## 8. 💰 Withdrawal Flow (Detailed)

1. User builds withdrawal proposal:
   - Action 1: `USDC.approve(Distributor, amount)` (via TBA)
   - Action 2: `Distributor.distribute(nftId, amount, USDC)`

2. Voting period elapses
3. On success, RWAGovernor instructs TBA to execute both actions sequentially
4. Distributor:
   - Pulls funds from TBA
   - Iterates investors
   - Computes: `payout = (amount * investorShares) / totalShares`
   - Transfers USDC

Example:
- TBA balance: 1000 USDC
- Alice: 60%, Bob: 40%
- Withdraw 1000
- Payouts: 600 / 400

---

## 9. 📊 Deployment Addresses (Testnet)

```
DAO: 0x83300448E361038816368C9683D61dCF2d60954E
GovToken: 0xD546E8a7f37dB24dE9B637cb79B10f1c5885A51d
MainTimelock: 0x5F42C1C914F671394478646740Bd6d59b4F86Ce5
RWA NFT: 0xAC2935e31C097eFB7Ea20A64163751FFD5870860
RWA Governor Logic: 0xc1328380074Dc46e35F3A8bb577Fba43b450d03b
Distributor: 0x679fddD3Ce087B15645D8fCb840AaE99a4aE9615
MockUSDC: 0x832144D002bB8F32AbDCc576Aaaa8c2F3a3B1c95
VotingPaymaster: 0x3207EEcBE70f58C3b553b683Aa3827B216f88314
Treasury Deployer: 0xf7bB047581E3B6FD5B2c744a533Abd1846ED09Ee
Deployment block (DAO): 9630914
```

Update `frontend/.env.local` & `constants.ts` if redeploying.

---

## 10. 🛠️ Development Workflow

### Contracts
```bash
forge build
forge test -vv
anvil
```

### Local Frontend Against Anvil
1. Start `anvil`
2. Deploy with a script (`forge script ... --broadcast`)
3. Copy addresses to `frontend/src/constants.ts`
4. Run frontend: `npm run dev`

### Interact with Cast
```bash
cast call <contract> "totalSupply()"
cast send <token> "transfer(address,uint256)" <to> 1000 --private-key $PK
```

---

## 11. ✅ Testing Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Invest & appear in portfolio | NFT card shows with shares |
| Create metadata proposal | Proposal listed under governance |
| Vote & weight check | Vote counts reflect shares |
| Double vote attempt | Rejected / disabled UI |
| Withdrawal proposal execute | Balances distributed & TBA reduced |
| No shares user actions | Propose / vote buttons disabled |
| Gasless vote (if integrated) | Vote succeeds without native token |

---

## 12. 🔮 Future Enhancements

- Quorum & proposal thresholds
- Timelock delays per RWA
- Emergency pause / guardians
- Cross-chain RWA support
- Yield streaming integration
- Off-chain metadata indexing
- Role-based access control refinements

---

## 13. 🔐 Security Considerations

| Area | Notes |
|------|-------|
| Reentrancy | Guard Distributor & DAO external calls |
| Over-Approval | Use exact approvals or reset patterns |
| Share Math | Use checked arithmetic; 18-decimal scaling |
| Upgradeability | If using proxies, restrict admin |
| Access Control | Only investors should propose/vote |
| Distribution Loop | Consider batching if large investor sets |
| Oracle / External Feeds | Not currently used; plan for validation later |
| TBA Control | Ensure only governor can instruct TBA |

---

## 14. ❓ FAQ

**Q: How are shares represented?**  
A: Scaled to 18 decimals in `rwaShares`; 1 unit of investment → scaled shares (configurable).

**Q: Can non-investors vote?**  
A: No. Voting power is zero if no shares for that NFT.

**Q: Where do funds sit?**  
A: In the NFT's TBA until distributed.

**Q: How does weighted voting work?**  
A: RWAGovernor reads `rwaShares[nftId][user]` as vote weight.

**Q: Are proposals batched?**  
A: Yes—withdrawals bundle multiple calls executed via TBA.

---

## 🧾 Original Implementation Summary (Reference)

A detailed build summary is preserved in `RWA_PORTFOLIO_README.md` (includes initial implementation notes and rationale).

---

## 🥁 Summary

Melody Bond delivers a modular, scalable model for per-asset governance with:
- Portfolio visibility
- Share-weighted voting
- Automated fund distribution
- Extensible contract stack via Foundry
- Modern React/Next.js frontend

Ready for testnet experimentation and iterative governance hardening.

---

## 🆘 Help (Foundry CLI)

```bash
forge --help
anvil --help
cast --help
```

---

## 📄 License

(Insert license information here, e.g. MIT / Apache-2.0)

---

## 🤝 Contributions

PRs welcome. Please:
1. Open an issue describing change
2. Include tests (Forge)
3. Ensure lint / format passes
4. Provide deployment notes if contracts are modified

---

Built with ❤️ using Foundry, Next.js, and on-chain governance patterns.
