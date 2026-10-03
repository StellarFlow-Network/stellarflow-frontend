const fs = require('fs');
const path = require('path');

const scriptRegex = /js\.src\s*=\s*['"]([^'\"]+)['"]/g;
const integrityRegex = /js\.integrity\s*=\s*['"]sha384-([A-Za-z0-9+/=]+)['"]/;
const fileExtensions = ['.tsx', '.ts', '.jsx', '.js'];

function* walkSync(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const res = path.resolve(dir, file.name);
    if (file.isDirectory()) yield* walkSync(res);
    else if (fileExtensions.includes(path.extname(file.name))) yield res;
  }
}

function verifyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  let anyIssue = false;
  
  while ((match = scriptRegex.exec(content)) !== null) {
    const srcUrl = match[1];
    
    // Quick regex to find integrity near the src
    const blockStart = content.lastIndexOf('{', match.index);
    let blockEnd = content.indexOf('}', match.index);
    if (blockStart === -1 || blockEnd === -1) {
        blockEnd = content.length;
    }
    const block = content.substring(blockStart, blockEnd + 1);
    const integrityMatch = integrityRegex.exec(block);
    
    if (!integrityMatch) {
      console.error(`[SRI] Missing or invalid integrity for ${srcUrl} in ${filePath}`);
      anyIssue = true;
    } else {
      console.log(`[SRI] Valid integrity found for ${srcUrl}`);
    }
  }
  return anyIssue;
}

const root = path.resolve(__dirname, '..', 'src');
const files = Array.from(walkSync(root));
let failures = 0;
for (const file of files) {
  if (verifyFile(file)) failures++;
}

if (failures > 0) {
  console.error(`[SRI] Verification failed (${failures} file(s) with issues).`);
  process.exit(1);
} else {
  console.log('[SRI] All external scripts have valid integrity attributes.');
  process.exit(0);
}
