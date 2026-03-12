/**
 * generate-brand-assets.ts — Creates OG image, favicon SVG, favicon ICO, and apple-touch-icon.
 *
 * Uses sharp (with built-in rsvg + pango) to render SVG designs to PNG/ICO.
 * No external dependencies beyond what's already installed.
 *
 * Usage: npx tsx scripts/generate-brand-assets.ts [--force]
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { PATHS } from "../lib/config.js";
import { isDirectRun, hasForceFlag } from "../lib/script-utils.js";
import { SITE_NAME, SITE_SUBTITLE, SITE_TAGLINE, SITE_DOMAIN } from "../lib/constants.js";

const PUBLIC_DIR = PATHS.publicDir;

// ─── Design tokens (matching site's Tailwind slate palette) ───────────────────

const COLORS = {
  bg: "#0f172a", // slate-900
  bgLight: "#1e293b", // slate-800
  accent: "#334155", // slate-700
  text: "#f8fafc", // slate-50
  textMuted: "#94a3b8", // slate-400
  border: "#475569", // slate-600
};

// ─── OG Image (1200x630) ─────────────────────────────────────────────────────

function ogImageSvg(): string {
  // Subtle dot grid pattern (deterministic — seeded by position)
  const dots: string[] = [];
  for (let x = 40; x < 1200; x += 40) {
    for (let y = 40; y < 630; y += 40) {
      const opacity = 0.06 + ((x * 7 + y * 13) % 100) * 0.0005;
      dots.push(
        `<circle cx="${x}" cy="${y}" r="1" fill="${COLORS.textMuted}" opacity="${opacity.toFixed(3)}"/>`,
      );
    }
  }

  // Geometric accent — angled lines in top-right
  const lines: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 850 + i * 50;
    const opacity = (0.04 + i * 0.01).toFixed(3);
    lines.push(
      `<line x1="${x}" y1="0" x2="${x - 200}" y2="630" stroke="${COLORS.textMuted}" stroke-width="1" opacity="${opacity}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.bg}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COLORS.accent}" stop-opacity="0"/>
      <stop offset="20%" stop-color="${COLORS.border}"/>
      <stop offset="80%" stop-color="${COLORS.border}"/>
      <stop offset="100%" stop-color="${COLORS.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Dot grid -->
  ${dots.join("\n  ")}

  <!-- Geometric accents -->
  ${lines.join("\n  ")}

  <!-- Accent line -->
  <rect x="80" y="305" width="400" height="2" fill="url(#accentLine)" rx="1"/>

  <!-- Name -->
  <text x="80" y="270" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="72" font-weight="700" fill="${COLORS.text}" letter-spacing="-1">${SITE_NAME}</text>

  <!-- Title -->
  <text x="80" y="355" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="400" fill="${COLORS.textMuted}">${SITE_SUBTITLE.replace(/&/g, "&amp;")}</text>

  <!-- Tagline -->
  <text x="80" y="400" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="${COLORS.border}">${SITE_TAGLINE}</text>

  <!-- Call-to-action button -->
  <rect x="80" y="440" width="220" height="48" rx="8" fill="${COLORS.text}"/>
  <text x="190" y="471" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="${COLORS.bg}">View Resume →</text>

  <!-- URL -->
  <text x="80" y="560" font-family="ui-monospace, 'Cascadia Code', 'Fira Code', monospace" font-size="18" fill="${COLORS.border}">${SITE_DOMAIN}</text>
</svg>`;
}

// ─── Favicon SVG ──────────────────────────────────────────────────────────────

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="${COLORS.bg}"/>
  <text x="256" y="340" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="280" font-weight="700" fill="${COLORS.text}" letter-spacing="-15">PP</text>
</svg>`;
}

// ─── ICO file builder ────────────────────────────────────────────────────────
// Minimal ICO spec: ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes) + PNG payload.
// Single 32x32 entry with 32-bit color depth (RGBA PNG).
// ICO spec: width/height 0 means 256px; we write 32 explicitly for 32x32.
// See: https://en.wikipedia.org/wiki/ICO_(file_format)

function buildIco(pngBuffer: Buffer): Buffer {
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // type: 1 = ICO
  iconDir.writeUInt16LE(1, 4); // count: 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width (32px; 0 would mean 256px per ICO spec)
  entry.writeUInt8(32, 1); // height (32px)
  entry.writeUInt8(0, 2); // color palette (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel (32-bit RGBA)
  entry.writeUInt32LE(pngBuffer.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([iconDir, entry, pngBuffer]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const force = hasForceFlag();
  console.log(`Generating brand assets...${force ? " (--force)" : ""}\n`);

  // Ensure output directory exists
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;

  // 1. OG Image
  const ogPath = path.join(PUBLIC_DIR, "og-image.png");
  if (!force && fs.existsSync(ogPath)) {
    console.log("  [skip] og-image.png already exists (use --force to regenerate)");
    skipped++;
  } else {
    const svg = ogImageSvg();
    const pngBuffer = await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer();
    fs.writeFileSync(ogPath, pngBuffer);
    console.log(`  [done] og-image.png (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
    generated++;
  }

  // 2. Favicon SVG
  const svgPath = path.join(PUBLIC_DIR, "favicon.svg");
  if (!force && fs.existsSync(svgPath)) {
    console.log("  [skip] favicon.svg already exists (use --force to regenerate)");
    skipped++;
  } else {
    const svg = faviconSvg();
    fs.writeFileSync(svgPath, svg);
    console.log(`  [done] favicon.svg (${Buffer.byteLength(svg)} bytes)`);
    generated++;
  }

  // 3. Favicon ICO (32x32 PNG in ICO container)
  const icoPath = path.join(PUBLIC_DIR, "favicon.ico");
  if (!force && fs.existsSync(icoPath)) {
    console.log("  [skip] favicon.ico already exists (use --force to regenerate)");
    skipped++;
  } else {
    const svg = faviconSvg();
    const png32 = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
    const ico = buildIco(png32);
    fs.writeFileSync(icoPath, ico);
    console.log(`  [done] favicon.ico (${(ico.length / 1024).toFixed(1)} KB)`);
    generated++;
  }

  // 4. Apple Touch Icon (180x180 PNG)
  const applePath = path.join(PUBLIC_DIR, "apple-touch-icon.png");
  if (!force && fs.existsSync(applePath)) {
    console.log("  [skip] apple-touch-icon.png already exists (use --force to regenerate)");
    skipped++;
  } else {
    const svg = faviconSvg();
    const png180 = await sharp(Buffer.from(svg)).resize(180, 180).png().toBuffer();
    fs.writeFileSync(applePath, png180);
    console.log(`  [done] apple-touch-icon.png (${(png180.length / 1024).toFixed(1)} KB)`);
    generated++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nBrand assets complete: ${generated} generated, ${skipped} skipped (${elapsed}s)`);
}

// Only run when executed directly (not when imported for testing).
if (isDirectRun("generate-brand-assets")) {
  main().catch((err) => {
    console.error("Brand asset generation failed:", err);
    process.exit(1);
  });
}

export const _testExports = { ogImageSvg, faviconSvg, buildIco, main, COLORS };
