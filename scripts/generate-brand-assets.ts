#!/usr/bin/env npx tsx
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

const PUBLIC_DIR = PATHS.publicDir;
const FORCE = process.argv.includes("--force");

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
  <text x="80" y="270" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="72" font-weight="700" fill="${COLORS.text}" letter-spacing="-1">Paul Prae</text>

  <!-- Title -->
  <text x="80" y="360" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="400" fill="${COLORS.textMuted}">Principal AI Engineer &amp; Architect</text>

  <!-- URL -->
  <text x="80" y="560" font-family="ui-monospace, 'Cascadia Code', 'Fira Code', monospace" font-size="18" fill="${COLORS.border}">paulprae.com</text>
</svg>`;
}

// ─── Favicon SVG ──────────────────────────────────────────────────────────────

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="${COLORS.bg}"/>
  <text x="256" y="340" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="280" font-weight="700" fill="${COLORS.text}" letter-spacing="-15">PP</text>
</svg>`;
}

// ─── ICO file builder (minimal spec: single 32x32 PNG entry) ──────────────────

function buildIco(pngBuffer: Buffer): Buffer {
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // type: 1 = ICO
  iconDir.writeUInt16LE(1, 4); // count: 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([iconDir, entry, pngBuffer]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Generating brand assets...\n");

  // 1. OG Image
  const ogPath = path.join(PUBLIC_DIR, "og-image.png");
  if (!FORCE && fs.existsSync(ogPath)) {
    console.log("  [skip] og-image.png already exists (use --force to regenerate)");
  } else {
    const svg = ogImageSvg();
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(1200, 630)
      .png({ quality: 90 })
      .toBuffer();
    fs.writeFileSync(ogPath, pngBuffer);
    console.log(`  [done] og-image.png (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
  }

  // 2. Favicon SVG
  const svgPath = path.join(PUBLIC_DIR, "favicon.svg");
  if (!FORCE && fs.existsSync(svgPath)) {
    console.log("  [skip] favicon.svg already exists (use --force to regenerate)");
  } else {
    const svg = faviconSvg();
    fs.writeFileSync(svgPath, svg);
    console.log(`  [done] favicon.svg (${Buffer.byteLength(svg)} bytes)`);
  }

  // 3. Favicon ICO (32x32 PNG in ICO container)
  const icoPath = path.join(PUBLIC_DIR, "favicon.ico");
  if (!FORCE && fs.existsSync(icoPath)) {
    console.log("  [skip] favicon.ico already exists (use --force to regenerate)");
  } else {
    const svg = faviconSvg();
    const png32 = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
    const ico = buildIco(png32);
    fs.writeFileSync(icoPath, ico);
    console.log(`  [done] favicon.ico (${(ico.length / 1024).toFixed(1)} KB)`);
  }

  // 4. Apple Touch Icon (180x180 PNG)
  const applePath = path.join(PUBLIC_DIR, "apple-touch-icon.png");
  if (!FORCE && fs.existsSync(applePath)) {
    console.log("  [skip] apple-touch-icon.png already exists (use --force to regenerate)");
  } else {
    const svg = faviconSvg();
    const png180 = await sharp(Buffer.from(svg)).resize(180, 180).png().toBuffer();
    fs.writeFileSync(applePath, png180);
    console.log(`  [done] apple-touch-icon.png (${(png180.length / 1024).toFixed(1)} KB)`);
  }

  console.log("\nBrand assets generated in public/");
}

// Only run when executed directly (not when imported for testing).
const isDirectRun = ["generate-brand-assets.ts", "generate-brand-assets.js"].includes(
  path.basename(process.argv[1] ?? ""),
);

if (isDirectRun) {
  main().catch((err) => {
    console.error("Brand asset generation failed:", err);
    process.exit(1);
  });
}

export { ogImageSvg, faviconSvg, buildIco };
export const _testExports = { ogImageSvg, faviconSvg, buildIco, COLORS };
