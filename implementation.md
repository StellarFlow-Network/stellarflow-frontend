# Soroban Contract Storage Footprint & Cost Calculator (#772)

## 1. Executive Summary

This document describes the technical architecture, mathematical specifications, complexity analysis, and integration guide for the **Soroban Contract Storage Footprint Cost Calculator** (Issue #772).

The calculator enables developers and protocol operators to preview state rent and storage footprint costs associated with deploying or interacting with Soroban smart contracts on Stellar, converting storage rent fees into Stroops, XLM, and USD equivalent values while highlighting key lifecycle and cost tradeoffs across **Persistent**, **Temporary**, and **Instance** storage tiers.

---

## 2. Soroban State Rent & Footprint Mechanics

### 2.1 Storage Tiers in Soroban
Soroban smart contracts utilize three storage tiers, each with distinct lifecycle, archival, and rent characteristics:

| Storage Tier | Archivable? | Restorable? | Cost Multiplier | Best Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| **Persistent** | Yes (moves to archive upon expiration) | Yes (via `restoreFootprint`) | `1.0x` (Baseline) | User token balances, escrow locks, governance votes |
| **Temporary** | No (permanently discarded upon expiration) | No (unrecoverable) | `0.5x` (~50% discount) | Price oracle feeds, nonces, rate-limiting, temporary quotes |
| **Instance** | Yes (shares lifecycle with contract instance) | Yes (restored when contract is restored) | `1.0x` | Contract admin keys, protocol paused status, WASM hash |

### 2.2 Mathematical Rent & Resource Fee Formulas

1. **Unit Conversion**:
   $$\text{XLM} = \frac{\text{Stroops}}{10,000,000}$$
   $$\text{USD} = \text{XLM} \times P_{\text{XLM/USD}}$$

2. **Effective Byte Size**:
   Every ledger entry incurs key overhead (default 64 bytes) in addition to payload bytes:
   $$\text{Effective Bytes} = \text{Payload Bytes} + (\text{Entry Count} \times \text{Key Overhead Bytes})$$

3. **Base Write & Read Resource Fees (One-time)**:
   $$\text{Write Fee (Stroops)} = \left\lceil \frac{\text{Effective Bytes}}{1024} \times \text{WRITE\_FEE\_PER\_1KB} \right\rceil$$
   $$\text{Read Fee (Stroops)} = \left\lceil \frac{\text{Effective Bytes}}{1024} \times \text{READ\_FEE\_PER\_1KB} \right\rceil$$

4. **State Rent Fee per Ledger**:
   $$\text{Rent Per Ledger (Stroops)} = \Big( (\text{Entry Count} \times \text{RENT\_FEE\_PER\_ENTRY}) + (\text{Effective Bytes} \times \text{RENT\_FEE\_PER\_BYTE}) \Big) \times \text{Tier Multiplier}$$

5. **Total Rent Fee across Duration ($L$ ledgers)**:
   $$\text{Total Rent Fee (Stroops)} = \left\lceil \text{Rent Per Ledger} \times L \right\rceil$$
   $$\text{Total Transaction Cost (Stroops)} = \text{Write Fee} + \text{Total Rent Fee}$$

6. **Ledger Time Units**:
   - Ledger close rate: $\approx 5\text{ seconds per ledger}$
   - 1 Day = $17,280\text{ ledgers}$
   - 1 Month (30 Days) = $518,400\text{ ledgers}$
   - 1 Year (365 Days) = $6,307,200\text{ ledgers}$

---

## 3. Architecture & Code Structure

The implementation follows a modular, clean-code architecture strictly separating domain computation, data services, and presentation:

```
src/
├── lib/
│   ├── storageCostCalculator.ts        # Pure domain calculation logic & protocol constants
│   └── storageCostCalculator.test.ts   # Automated unit tests for math and parsing
├── services/
│   └── storageFootprintService.ts      # Price feed and simulation payload bridge
├── components/
│   └── contracts/
│       └── StorageFootprintCalculator.tsx # Interactive UI component
└── app/
    └── contracts/
        └── page.tsx                    # Contracts management dashboard
```

### 3.1 Domain Calculation Engine (`src/lib/storageCostCalculator.ts`)
- **`calculateStorageCost(params)`**: Evaluates exact write fee, read fee, state rent, and time projections (daily, monthly, annual) in Stroops, XLM, and USD.
- **`compareStorageTradeoffs(params)`**: Generates comparative tradeoff analysis across Persistent, Temporary, and Instance storage.
- **`parseSimulationFootprint(simResponse, xlmPrice)`**: Ingests raw Soroban RPC `simulateTransaction` response payloads, extracting read/write byte footprints, key counts, and minimum resource fees.
- **`estimateContractDeploymentFootprint(params)`**: Estimates initial WASM bytecode deployment and ongoing instance maintenance costs.

### 3.2 Service Layer (`src/services/storageFootprintService.ts`)
- Bridges real-time/cached price storage (`src/lib/priceStorage.ts`) with fallback handling.
- Provides asynchronous helper functions (`getXlmUsdRate`, `analyzeSimulationPayload`, `calculateCustomStoragePreview`).

### 3.3 Interactive UI (`src/components/contracts/StorageFootprintCalculator.tsx`)
- **Custom Estimator Tab**: Sliders, number inputs, and presets (Oracle Feed, User Balance, DEX Pool, Admin Config, WASM Code) with real-time reactive calculations.
- **RPC Simulation Analyzer Tab**: JSON inspector parsing raw simulation outputs into actionable byte allocations and rent projections.
- **Storage Tier Tradeoffs Tab**: Side-by-side comparison matrix outlining cost savings (e.g. 50% temporary discount), archival policies, and best architectural patterns.

---

## 4. Complexity & Performance Analysis

### 4.1 Time Complexity
- **`calculateStorageCost`**: $\mathcal{O}(1)$ constant time. Involves basic scalar arithmetic and ceiling operations without loops or recursive calls.
- **`compareStorageTradeoffs`**: $\mathcal{O}(1)$ constant time. Runs three scalar evaluations for the predefined three tiers.
- **`parseSimulationFootprint`**: $\mathcal{O}(K)$ linear time, where $K = |ReadOnlyKeys| + |ReadWriteKeys|$ from the simulation footprint. Operates directly on array length properties without deep traversals.
- **UI Rendering**: Uses `React.useMemo` for derived calculation states, ensuring zero unnecessary recalculations during unrelated render cycles.

### 4.2 Space Complexity
- **`calculateStorageCost`**: $\mathcal{O}(1)$ auxiliary space. Allocates a flat breakdown object with numeric primitives.
- **`parseSimulationFootprint`**: $\mathcal{O}(1)$ auxiliary space beyond the output summary payload.

---

## 5. Verification & Testing

Unit tests are located in `src/lib/storageCostCalculator.test.ts` and executed using the native Node test runner:
```bash
node --experimental-strip-types --test src/lib/storageCostCalculator.test.ts
```

### Test Coverage:
1. **Persistent Storage Cost**: Validates base write fee + monthly rent in Stroops and XLM against exact arithmetic expectations.
2. **Temporary Storage Discount**: Confirms the 50% rent discount multiplier for temporary state.
3. **Edge Case Handling**: Validates behavior for 0-byte entries, 0 ledgers, and overhead calculations.
4. **Duration Formatter**: Confirms human-friendly formatting of ledger intervals from seconds to years.
5. **Tradeoff Comparison Matrix**: Validates structure, flags, and recommendations across all 3 tiers.
6. **Simulation Response Parser**: Confirms extraction of read/write bytes, keys, and fees from standard Soroban RPC JSON structures.
7. **Deployment Estimator**: Validates upfront vs annual maintenance footprint estimates for contract WASMs.
