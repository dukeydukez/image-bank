#!/usr/bin/env node

/**
 * Image Bank Uploader
 *
 * Copies an image to the image-bank repo, pushes to GitHub,
 * and returns the raw URL ready for Late/Zernio scheduling.
 *
 * Usage:
 *   node upload.mjs <image-path> [folder]
 *
 * Examples:
 *   node upload.mjs ~/Downloads/headshot.jpg linkedin
 *   node upload.mjs ./ad-creative.png general
 *   node upload.mjs ~/Desktop/quote-card.jpg x
 *   node upload.mjs ~/Downloads/kclc-post.jpg kclc/linkedin
 *   node upload.mjs ~/Downloads/kclc-ad.png kclc/x
 *
 * Folders (Dwayne personal): linkedin, x, threads, general
 * KCLC:    kclc/linkedin, kclc/x, kclc/threads, kclc/general
 * Corex:   corex/instagram, corex/threads, corex/general
 * Default: general
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { basename, resolve, join } from "node:path";

const REPO_DIR = resolve(new URL(".", import.meta.url).pathname);
const GITHUB_USER = "dukeydukez";
const REPO_NAME = "image-bank";
const BRANCH = "main";
const VALID_FOLDERS = [
  "linkedin", "x", "threads", "general",
  "kclc/linkedin", "kclc/x", "kclc/threads", "kclc/general",
  "corex/instagram", "corex/threads", "corex/general",
];
const MAX_FILE_SIZE_MB = 25;

function buildRawUrl(folder, filename) {
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}/social/${folder}/${filename}`;
}

function run(cmd) {
  return execSync(cmd, { cwd: REPO_DIR, encoding: "utf-8" }).trim();
}

async function verifyUrl(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return true;
    } catch {
      // CDN not ready yet
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  return false;
}

async function main() {
  const [imagePath, folder = "general"] = process.argv.slice(2);

  if (!imagePath) {
    console.error("Usage: node upload.mjs <image-path> [folder]");
    console.error("Folders: linkedin, x, threads, general");
    process.exit(1);
  }

  if (!VALID_FOLDERS.includes(folder)) {
    console.error(`Invalid folder "${folder}". Use: ${VALID_FOLDERS.join(", ")}`);
    process.exit(1);
  }

  const resolvedPath = resolve(imagePath);
  if (!existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const stats = statSync(resolvedPath);
  const sizeMB = stats.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    console.error(`File too large (${sizeMB.toFixed(1)}MB). Max: ${MAX_FILE_SIZE_MB}MB`);
    process.exit(1);
  }

  const filename = basename(resolvedPath);
  const destDir = join(REPO_DIR, "social", folder);
  const destPath = join(destDir, filename);

  // Pull latest to avoid conflicts
  run("git pull --rebase origin main");

  // Copy file into repo
  copyFileSync(resolvedPath, destPath);

  // Commit and push
  run(`git add "social/${folder}/${filename}"`);
  run(`git commit -m "add: ${folder}/${filename}"`);
  run("git push origin main");

  const rawUrl = buildRawUrl(folder, filename);

  console.log("\n--- Image uploaded ---");
  console.log(`File:   ${filename}`);
  console.log(`Folder: social/${folder}/`);
  console.log(`URL:    ${rawUrl}`);

  // Verify CDN propagation
  console.log("\nVerifying URL is live...");
  const isLive = await verifyUrl(rawUrl);

  if (isLive) {
    console.log("Confirmed — URL is live and ready for Late.");
  } else {
    console.log("URL pushed but CDN may need a minute. The URL will work shortly:");
  }

  console.log(`\n${rawUrl}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
