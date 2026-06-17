// Run: node scripts/generate-icons.mjs
// Requires: npm install sharp --save-dev

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Wrap SVG in a square background to look good as an app icon
const svgSource = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');

// Create a padded square SVG (icon needs to be square)
const paddedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a1a2e"/>
  <g transform="translate(80, 83) scale(7.33, 7.33)">
    ${svgSource.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
</svg>`;

const paddedBuffer = Buffer.from(paddedSvg);

// Regular icons
await sharp(paddedBuffer).resize(192, 192).png().toFile(resolve(root, 'public/icon-192.png'));
console.log('✅ icon-192.png');

await sharp(paddedBuffer).resize(512, 512).png().toFile(resolve(root, 'public/icon-512.png'));
console.log('✅ icon-512.png');

// Maskable icon — needs safe zone (content in center 80%)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1a1a2e"/>
  <g transform="translate(106, 126) scale(6.25, 6.25)">
    ${svgSource.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
</svg>`;

await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(resolve(root, 'public/icon-512-maskable.png'));
console.log('✅ icon-512-maskable.png');

console.log('\nDone! Icons written to public/');
