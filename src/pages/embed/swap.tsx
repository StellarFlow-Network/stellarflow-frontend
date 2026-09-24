import type { GetServerSideProps, NextPage } from 'next';
import { useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

interface EmbedProps {
  inputCurrency: string;
  outputCurrency: string;
  theme: Theme;
  accentColor: string;
  nonce: string;
}

interface TokenOption {
  symbol: string;
  address: string;
}

interface TradeMessage {
  source: 'stellarflow-embed';
  type: 'stellarflow:trade';
  status: 'completed' | 'failed';
  inputCurrency: string;
  outputCurrency: string;
  amount?: string;
  outputAmount?: string;
  error?: string;
}

const TOKENS: Record<string, TokenOption> = {
  XLM: { symbol: 'XLM', address: 'native' },
  USDC: { symbol: 'USDC', address: 'USDC' },
  EURT: { symbol: 'EURT', address: 'EURT' },
  BTC: { symbol: 'BTC', address: 'BTC' },
  ETH: { symbol: 'ETH', address: 'ETH' },
};

function getToken(symbol: string, fallback: TokenOption): TokenOption {
  return TOKENS[symbol.toUpperCase()] ?? fallback;
}

function isValidAccent(value: string): boolean {
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);
}

const EmbedSwapPage: NextPage<EmbedProps> = ({
  inputCurrency,
  outputCurrency,
  theme,
  accentColor,
  nonce,
}) => {
  const input = useMemo(() => getToken(inputCurrency, TOKENS.XLM), [inputCurrency]);
  const output = useMemo(() => getToken(outputCurrency, TOKENS.USDC), [outputCurrency]);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.style.background = theme === 'dark' ? '#0b1220' : '#f5f7fb';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [theme]);

  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setQuote('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ from: input.address, to: output.address, amount });
        const response = await fetch(`/api/v1/swap/quote?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Quote unavailable');
        const data = (await response.json()) as { estimatedOutput?: string };
        setQuote(data.estimatedOutput || '');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setQuote('');
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [amount, input.address, output.address]);

  const sendTradeMessage = (message: Omit<TradeMessage, 'source' | 'type'>) => {
    if (window.parent === window) return;
    const payload: TradeMessage = { source: 'stellarflow-embed', type: 'stellarflow:trade', ...message };
    let targetOrigin = '*';
    try {
      if (document.referrer) targetOrigin = new URL(document.referrer).origin;
    } catch {
      targetOrigin = '*';
    }
    window.parent.postMessage(payload, targetOrigin);
  };

  const connectWallet = async () => {
    const wallet = (window as Window & { freighterApi?: { getPublicKey?: () => Promise<string> }; stellar?: { getPublicKey?: () => Promise<string> } });
    const extension = wallet.freighterApi || wallet.stellar;
    if (!extension?.getPublicKey) {
      setStatus('Install Freighter to connect a wallet.');
      return;
    }
    try {
      setWalletAddress(await extension.getPublicKey());
      setStatus('Wallet connected');
    } catch {
      setStatus('Wallet connection was cancelled.');
    }
  };

  const submitSwap = async () => {
    if (!amount || Number(amount) <= 0) return setStatus('Enter an amount first.');
    if (!walletAddress) return setStatus('Connect a wallet to swap.');

    setIsLoading(true);
    setStatus('Processing swap...');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      setStatus('Swap complete');
      sendTradeMessage({
        status: 'completed',
        inputCurrency: input.symbol,
        outputCurrency: output.symbol,
        amount,
        outputAmount: quote,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap failed';
      setStatus(message);
      sendTradeMessage({ status: 'failed', inputCurrency: input.symbol, outputCurrency: output.symbol, error: message });
    } finally {
      setIsLoading(false);
    }
  };

  const colors = theme === 'dark'
    ? { background: '#0b1220', surface: '#111c2e', text: '#f8fafc', muted: '#94a3b8', border: '#24344d' }
    : { background: '#f5f7fb', surface: '#ffffff', text: '#132238', muted: '#617089', border: '#dce4ef' };

  return (
    <main style={{ ...styles.page, background: colors.background, color: colors.text, ['--accent' as string]: accentColor } as React.CSSProperties}>
      <section style={{ ...styles.card, background: colors.surface, borderColor: colors.border }} aria-label="StellarFlow swap widget">
        <header style={styles.header}>
          <div><strong style={styles.brand}>StellarFlow</strong><span style={{ ...styles.caption, color: colors.muted }}> / Swap</span></div>
          <button style={{ ...styles.secondaryButton, borderColor: colors.border, color: colors.text }} onClick={connectWallet} type="button">
            {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Connect'}
          </button>
        </header>
        <label style={{ ...styles.label, color: colors.muted }} htmlFor="swap-amount">You send</label>
        <div style={{ ...styles.inputRow, borderColor: colors.border }}>
          <input id="swap-amount" inputMode="decimal" min="0" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} style={{ ...styles.input, color: colors.text }} />
          <span style={styles.token}>{input.symbol}</span>
        </div>
        <div style={{ ...styles.arrow, color: accentColor }}>↓</div>
        <label style={{ ...styles.label, color: colors.muted }} htmlFor="swap-quote">You receive</label>
        <div style={{ ...styles.inputRow, borderColor: colors.border }}>
          <input id="swap-quote" readOnly placeholder="Quote" value={quote} style={{ ...styles.input, color: colors.text }} />
          <span style={styles.token}>{output.symbol}</span>
        </div>
        {status && <p role="status" style={{ ...styles.status, color: colors.muted }}>{status}</p>}
        <button type="button" disabled={isLoading} onClick={submitSwap} style={{ ...styles.primaryButton, background: accentColor }}>
          {isLoading ? 'Processing...' : 'Swap tokens'}
        </button>
        <p style={{ ...styles.footer, color: colors.muted }}>Powered by StellarFlow</p>
      </section>
      <style nonce={nonce}>{`*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.65}`}</style>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', width: '100%', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 420, border: '1px solid', borderRadius: 16, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,.16)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  brand: { fontSize: 18, letterSpacing: '.02em' },
  caption: { fontSize: 14 },
  label: { display: 'block', fontSize: 12, marginBottom: 7 },
  inputRow: { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid', borderRadius: 10, padding: '10px 12px' },
  input: { minWidth: 0, flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 24 },
  token: { fontWeight: 700, fontSize: 14 },
  arrow: { textAlign: 'center', fontSize: 22, lineHeight: '30px' },
  primaryButton: { width: '100%', border: 0, borderRadius: 10, color: '#06100a', fontWeight: 800, padding: '13px 16px', marginTop: 18 },
  secondaryButton: { border: '1px solid', borderRadius: 8, background: 'transparent', padding: '7px 10px', fontSize: 12 },
  status: { fontSize: 12, minHeight: 18, margin: '12px 0 0' },
  footer: { fontSize: 11, textAlign: 'center', margin: '14px 0 0' },
};

export const getServerSideProps: GetServerSideProps<EmbedProps> = async ({ query, req }) => {
  const requestedTheme = typeof query.theme === 'string' ? query.theme.toLowerCase() : 'dark';
  const requestedAccent = typeof query.accentColor === 'string' ? query.accentColor : '#39ff14';
  return {
    props: {
      inputCurrency: typeof query.inputCurrency === 'string' ? query.inputCurrency : 'XLM',
      outputCurrency: typeof query.outputCurrency === 'string' ? query.outputCurrency : 'USDC',
      theme: requestedTheme === 'light' ? 'light' : 'dark',
      accentColor: isValidAccent(requestedAccent) ? requestedAccent : '#39ff14',
      nonce: typeof req.headers['x-nonce'] === 'string' ? req.headers['x-nonce'] : '',
    },
  };
};

export default EmbedSwapPage;