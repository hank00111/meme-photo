/**
 * Generate extension icons from SVG source
 * 
 * This script converts the SVG favicon to PNG icons in various sizes
 * required for Chrome Web Store and browser toolbar.
 * 
 * Sizes required:
 * - 16x16: Browser toolbar
 * - 32x32: Windows desktop shortcut
 * - 48x48: Extensions management page
 * - 128x128: Chrome Web Store (actual icon should be 96x96 with 16px padding)
 * 
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SIZES = [16, 32, 48, 128];
const SOURCE_SVG = join(__dirname, '..', 'asset', 'favicon.svg');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'icons');

async function generateIcons() {
  console.log('Starting icon generation...');
  console.log(`Source: ${SOURCE_SVG}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Create output directory if it doesn't exist
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  // Read SVG file
  const svgBuffer = await fs.readFile(SOURCE_SVG);
  console.log(`Read SVG file: ${svgBuffer.length} bytes`);

  // Generate each size
  for (const size of SIZES) {
    const outputPath = join(OUTPUT_DIR, `icon-${size}.png`);
    
    await sharp(svgBuffer, { density: 300 })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    
    console.log(`Generated: icon-${size}.png`);
  }

  console.log('\nAll icons generated successfully!');
  console.log('\nNext steps:');
  console.log('1. Update manifest.json with icons field');
  console.log('2. Verify icons in Chrome extension management page');
}

generateIcons().catch(console.error);
