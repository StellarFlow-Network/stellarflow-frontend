/**
 * PWA icon generator.
 *
 * Attempts to generate PNG icons from public/sf.webp using sharp.
 * Falls back silently if sharp is unavailable — SVG icons in the
 * manifest provide coverage for modern browsers.
 */

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.info(
    "ℹ  sharp not available — skipping PNG icon generation.",
    "\n   SVG icons in manifest.json cover modern browsers.",
    "\n   Install sharp (npm install -D sharp) to generate PNG icons locally."
  );
  process.exit(0);
}

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "public", "sf.webp");
const OUT_DIR = path.join(__dirname, "..", "public");

const SIZES = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
];

async function generate() {
  if (!fs.existsSync(SOURCE)) {
    console.warn("⚠  sf.webp not found at", SOURCE, "— skipping PNG icon generation.");
    return;
  }

  for (const { size, name } of SIZES) {
    const outPath = path.join(OUT_DIR, name);
    await sharp(SOURCE)
      .resize(size, size, { fit: "cover", position: "center" })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated ${name} (${size}×${size})`);
  }
}

generate().catch((err) => {
  console.error("Failed to generate PWA icons:", err);
  process.exit(1);
});
