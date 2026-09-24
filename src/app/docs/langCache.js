// Lightweight language/style configuration cache for docs tab switching
// Keeps an in-memory cache and a localStorage fallback (if available).

const CONFIG_VERSION = 'v1';
const STORAGE_KEY = `sf:docs:lang-config:${CONFIG_VERSION}`;

const defaultConfigs = {
  rust: {
    id: 'rust',
    label: 'Rust SDK (Soroban)',
    code: `#![no_std]
use soroban_sdk::{contractimpl, Env, Address, Symbol};

pub struct ConsumerContract;

#[contractimpl]
impl ConsumerContract {
    pub fn read_oracle_rate(env: Env, oracle_id: Address) -> u128 {
        // Invoke StellarFlow core proxy using dynamic interface
        let asset_symbol = Symbol::new(&env, "NGN");
        let rate: u128 = env.invoke_contract(
            &oracle_id,
            &Symbol::new(&env, "get_latest_rate"),
            soroban_sdk::vec![&env, asset_symbol.to_val()]
        );
        rate
    }
}`
  },
  js: {
    id: 'js',
    label: 'Stellar JS SDK',
    code: `import { Contract, networks } from '@stellar/stellar-sdk';

const contractId = 'CCEMOFO5TE7FGOAJOA3RDHPC6RW3CFXRVIGOFQPFE4ZGOKA2QEA636SN';
const stellarFlowOracle = new Contract(contractId);

async function fetchLiveRate(providerRpcUrl) {
  // Query latest decentralized exchange base rates
  const response = await providerRpcUrl.getLatestRate({
    asset: 'NGN'
  });
  console.log('Live Oracle Rate: ' + response.rate);
}`
  }
};

// Runtime in-memory cache (fast path)
const runtimeCache = new Map();

function hasWindowLocalStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

function readFromStorage() {
  if (!hasWindowLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    return null;
  }
}

function writeToStorage(obj) {
  if (!hasWindowLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    // ignore quota errors
  }
}

function populateRuntimeFromStorageOrDefaults() {
  if (runtimeCache.size > 0) return;
  const stored = readFromStorage();
  if (stored && typeof stored === 'object') {
    Object.keys(stored).forEach((k) => runtimeCache.set(k, stored[k]));
    return;
  }
  // populate defaults and persist them
  Object.keys(defaultConfigs).forEach((k) => runtimeCache.set(k, defaultConfigs[k]));
  writeToStorage(Object.fromEntries(runtimeCache.entries()));
}

function getLangConfig(lang) {
  if (!lang) return null;
  if (runtimeCache.has(lang)) {
    return runtimeCache.get(lang);
  }
  // lazy populate runtime from storage or defaults
  populateRuntimeFromStorageOrDefaults();
  return runtimeCache.get(lang) || null;
}

function setLangConfig(lang, config) {
  if (!lang || !config) return;
  runtimeCache.set(lang, config);
  // persist best-effort
  try {
    const obj = Object.fromEntries(runtimeCache.entries());
    writeToStorage(obj);
  } catch (e) {
    // ignore
  }
}

module.exports = {
  getLangConfig,
  setLangConfig,
  populateRuntimeFromStorageOrDefaults,
  // export for tests
  _internals: {
    runtimeCache,
    defaultConfigs,
    STORAGE_KEY,
  }
};
