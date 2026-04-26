const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const compression = require('shrink-ray-current'); // For Brotli support

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// When using a custom server, you need to pass the Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
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
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});