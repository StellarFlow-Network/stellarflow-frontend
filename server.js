const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const compression = require('shrink-ray-current'); // For Brotli support
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// When using a custom server, you need to pass the Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Apply compression middleware
    // shrink-ray-current will automatically detect Accept-Encoding and apply Brotli/Gzip
    compression({
      // Optional: Configure options for shrink-ray-current
      // For example, to only compress certain types:
      // filter: (req, res) => {
      //   return /json|text|javascript|css|image\/svg\+xml/.test(res.getHeader('Content-Type'));
      // },
      // brotli: {
      //   quality: 11, // Brotli compression quality (0-11)
      // },
      // gzip: {
      //   level: 9, // Gzip compression level (0-9)
      // }
    })(req, res, () => {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });
  });

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  // Store active connections and subscriptions
  const connections = new Map();
  const assetSubscriptions = new Map();

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    connections.set(ws, new Set());
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: Date.now()
    }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, data);
      } catch (error) {
        console.error('Invalid message format:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      cleanupConnection(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      cleanupConnection(ws);
    });
  });

  function handleMessage(ws, data) {
    const { type, assetIds } = data;
    
    switch (type) {
      case 'subscribe':
        if (Array.isArray(assetIds)) {
          const subscribedAssets = connections.get(ws) || new Set();
          
          assetIds.forEach(assetId => {
            subscribedAssets.add(assetId);
            
            if (!assetSubscriptions.has(assetId)) {
              assetSubscriptions.set(assetId, new Set());
            }
            assetSubscriptions.get(assetId).add(ws);
          });
          
          connections.set(ws, subscribedAssets);
          
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            assetIds,
            timestamp: Date.now()
          }));
        }
        break;
        
      case 'unsubscribe':
        if (Array.isArray(assetIds)) {
          const subscribedAssets = connections.get(ws) || new Set();
          
          assetIds.forEach(assetId => {
            subscribedAssets.delete(assetId);
            
            const subscribers = assetSubscriptions.get(assetId);
            if (subscribers) {
              subscribers.delete(ws);
              if (subscribers.size === 0) {
                assetSubscriptions.delete(assetId);
              }
            }
          });
          
          connections.set(ws, subscribedAssets);
        }
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  function cleanupConnection(ws) {
    const subscribedAssets = connections.get(ws);
    if (subscribedAssets) {
      subscribedAssets.forEach(assetId => {
        const subscribers = assetSubscriptions.get(assetId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            assetSubscriptions.delete(assetId);
          }
        }
      });
      connections.delete(ws);
    }
  }

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = parse(request.url, true);
    
    if (parsedUrl.pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Simulate price updates for demo purposes
  function simulatePriceUpdates() {
    const assets = ['NGN-XLM', 'USD-XLM', 'EUR-XLM'];
    
    setInterval(() => {
      assets.forEach(assetId => {
        const subscribers = assetSubscriptions.get(assetId);
        if (subscribers && subscribers.size > 0) {
          // Generate realistic price updates
          const basePrice = assetId === 'NGN-XLM' ? 750 : assetId === 'USD-XLM' ? 0.12 : 0.13;
          const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
          const newPrice = basePrice * (1 + variation);
          
          const update = {
            type: Math.random() > 0.7 ? 'delta_update' : 'price_update',
            assetId,
            data: {
              id: assetId,
              assetPair: assetId,
              price: newPrice,
              decimals: assetId === 'NGN-XLM' ? 2 : 6,
              source: 'stellarflow-oracle',
              timestamp: Date.now(),
              confidenceScore: 0.95 + Math.random() * 0.04
            },
            timestamp: Date.now()
          };
          
          subscribers.forEach(ws => {
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(JSON.stringify(update));
            }
          });
        }
      });
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds
  }

  // Start simulation after a delay
  setTimeout(simulatePriceUpdates, 1000);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server running on ws://${hostname}:${port}/api/ws`);
  });
});