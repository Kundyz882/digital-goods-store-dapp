# Digital Goods Store (DApp) — Sepolia Testnet

Decentralized marketplace for digital goods where users can list products for sale and buy them using **test ETH** on **Sepolia**.  
Each purchase automatically mints an educational **ERC-20 reward token (DSR)** to the buyer.  
MetaMask is required.

---

## Features (What the app can do)

### Marketplace
- Connect via **MetaMask**
- Create product listings (title, description, image URL, category, price)
- Browse active listings (filter by category + search by title)
- Buy products with **test ETH**
- Buyers receive **DSR reward tokens** automatically

### My Account
- View **My Listings**
- Unlist active products (if not sold)
- View **My Purchases**
- Seller can **withdraw earned ETH** (safe pattern: pending withdrawals)

---

## Tech Stack
- **Solidity (0.8.20)**
- **Hardhat**
- **OpenZeppelin**
- **JavaScript + Ethers v6**
- **MetaMask**
- **Ethereum Testnet: Sepolia**

---

## Smart Contracts

### 1) RewardToken.sol
ERC-20 token:
- Name: **Digital Store Reward**
- Symbol: **DSR**
- Minting is restricted by `onlyOwner`
- Ownership is transferred to the store contract after deploy

### 2) DigitalGoodsStore.sol
Main marketplace logic:
- Create product listings with category and ETH price
- Buy product by paying exact ETH price
- Tracks purchases & listings per wallet
- Unlist product (only seller, only if not sold)
- **Withdraw pattern** using `pendingWithdrawals` + `ReentrancyGuard`
- Automatically mints DSR rewards on purchase

---

## Contract Addresses (Sepolia)

- **Store:** 0xDdD1D8CD4C452c3568B5EC0232fc887Aaf16542F
- **Token:** 0xBD34a6Ac3a2326DfF74F4A44BE84d74187115ccB

---

## Project Structure

contracts/
- DigitalGoodsStore.sol  
- RewardToken.sol  

frontend/
- index.html  
- app.js  
- style.css  

scripts/
- deploy.js  

test/
- DigitalGoodsStore.test.js  

---

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Configure `.env` (do not upload):
```env
SEPOLIA_RPC_URL=...
PRIVATE_KEY=...
```

3. Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

4. Open frontend:
Open `frontend/index.html` via local server.

---

## Tests
```bash
npx hardhat test
```

##  Obtaining Test ETH
Test ETH was obtained using the Sepolia Proof-of-Work (PoW) Faucet.
Users provide their wallet address and complete a lightweight mining process to receive free test ETH.

Test ETH is used only for development and testing and has no real monetary value.

---

##  Course
Blockchain 1 — Final Examination Project

## Team members
Musagali Kundyz 

Dias Mukhametkali

Nurdaulet Amangos
