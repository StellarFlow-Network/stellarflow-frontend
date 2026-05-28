# 🌊 StellarFlow Frontend

> 🌍 **Africa-Oriented Data Oracle Dashboard** | Modern Web3 interface for localized real-time data on Stellar.

StellarFlow Frontend is a cutting-edge **Next.js 15** application that provides a seamless user interface for interacting with the StellarFlow Oracle. [cite_start]Our platform specializes in providing localized, high-impact data visualizations for the African market[cite: 1, 12].

## 🚀 Features
- **💰 Multi-Currency Support**: View data in XLM, NGN, KES, and GHS.
- [cite_start]**🔐 Wallet Integration**: Support for Albedo and Freightliner[cite: 701].
- [cite_start]**📱 Mobile-First Design**: Optimized for performance on lower-bandwidth devices using Tailwind CSS[cite: 1, 91].
- [cite_start]**📊 Live Oracle Feed**: Real-time status updates from the StellarFlow Backend[cite: 5, 185].

## 🛠️ Quick Start
### Prerequisites
- [cite_start]**Node.js** v18+ [cite: 83]
- [cite_start]**Stellar Wallet** (Albedo recommended) [cite: 760]

# FIGMA LINK
Here is the link to all available pages for the frontend issues. [Design link](https://www.figma.com/design/HmyIvuam4XSebSTZwayBLp/STELLAR-FLOW-NETWORK?node-id=0-1&t=H2Bg3XedVscGk4Xx-1)

### Installation
```bash
git clone [https://github.com/StellarFlow-Network/stellarflow-frontend.git](https://github.com/StellarFlow-Network/stellarflow-frontend.git)
cd stellarflow-frontend
npm install
npm run dev
```
🎨 Tech Stack

Framework: Next.js 15 (App Router) 
Styling: Tailwind CSS 
State Management: Zustand 
Web3: @stellar/stellar-sdk

---

### 2. Backend README (`stellarflow-backend`)
**Location:** `stellarflow-backend/README.md`

```markdown
# ⚙️ StellarFlow Backend

> 🏗️ **Oracle Infrastructure & Data Engine** | TypeScript/Node.js backend for the StellarFlow network.

This repository serves as the central data engine for StellarFlow. It orchestrates real-time price fetching from localized African markets and feeds that data to the Soroban smart contracts on the Stellar blockchain[cite: 17, 172].

## 🛠️ Key Services
- **🛰️ Price Oracle**: Fetches real-time exchange rates (e.g., NGN/XLM) every 10 seconds[cite: 179].
- **🔗 Soroban Service**: Interfaces with on-chain contracts to resolve oracle data[cite: 180].
- **🛡️ JWT Auth**: Secure, wallet-based authentication[cite: 172].
- **💾 Database**: Scalable PostgreSQL with Prisma ORM[cite: 194].

## 📂 Project Structure
```text
├── prisma/        # Database schema and migrations [cite: 194]
├── src/
│   ├── routes/    # API Endpoints [cite: 174]
│   ├── services/  # Business logic (Oracle, Soroban) [cite: 175]
│   └── utils/     # Helper functions [cite: 176]

Running the Server

Configure .env: Copy .env.example and add your SOROBAN_ADMIN_SECRET.
Install: npm install 
Run: npm run dev

---

### 3. Smart Contracts README (`stellarflow-contracts`)
**Location:** `stellarflow-contracts/README.md`
```

```markdown
# 📜 StellarFlow Smart Contracts

> 💎 **Soroban Smart Contracts** | The trustless core of the StellarFlow Oracle.

These smart contracts, written in **Rust**, manage the on-chain verification and storage of Oracle data. Built specifically for the **Soroban** platform on Stellar[cite: 170, 443].

## 🛡️ Contract Functions
- **`initialize`**: Set the admin and authorized data providers.
- **`push_data`**: Allow authorized oracles to submit new data points.
- **`get_latest_price`**: Public function for other dApps to consume Oracle data.

## 🔧 Development
### Prerequisites
- **Rust Toolchain**: `rustup` [cite: 195]
- **Stellar CLI**: `stellar-cli` 

### Build & Test
```bash
# Build the contract to .wasm
stellar contract build

# Run unit tests
cargo test

Acknowledgments
Built with ❤️ for the Stellar Africa community.
```

## 📦 Bundle Analysis & Optimization

Description
Unchecked framework optimization configurations risk leaving non-essential code paths active in the deployment bundle. Use the bundle analysis tooling below to inspect and eliminate redundant code before deploying to test or production networks.

Quick checks
- **Install dev deps**: Run `npm install --save-dev @next/bundle-analyzer cross-env webpack-bundle-analyzer`.
- **Run analysis**: `npm run analyze` — this sets `ANALYZE=true` and runs `next build`. The analyzer will produce an interactive report (usually available in `.next/analyze` or printed links in stdout).

Technical requirements
- **Run explicit build analysis** before testnet deployment to identify large or duplicated modules.
- **Audit vendor bundles** and remove unused imports or dynamic-import where feasible.

If you find this useful, please star the project and leave a review! 😁
