const http = require('http');
const https = require('https');
const zlib = require('zlib');

const url = 'http://localhost:3000/api/price-feed/ngn-xlm'; // Adjust URL as needed

async function verifyCompression(encoding) {
  console.log(`\n--- Verifying with Accept-Encoding: ${encoding} ---`);
  const client = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        headers: {
          'Accept-Encoding': encoding,
        },
      },
      (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Content-Encoding: ${res.headers['content-encoding'] || 'None'}`);
        console.log(`Content-Type: ${res.headers['content-type'] || 'None'}`);
        console.log(`Content-Length (compressed): ${res.headers['content-length'] || 'N/A'}`);

        let rawData = Buffer.from([]);
        res.on('data', (chunk) => (rawData = Buffer.concat([rawData, chunk])));
        res.on('end', () => {
          console.log(`Body size (compressed): ${rawData.length} bytes`);
          resolve();
        });
      }
    );
    req.on('error', reject);
  });
}

(async () => {
  await verifyCompression('gzip');
  await verifyCompression('br');
  await verifyCompression('gzip, deflate, br');
})();