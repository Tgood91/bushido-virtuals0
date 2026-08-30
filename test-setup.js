#!/usr/bin/env node

/**
 * VIRTUALS DIP-BUY JOB — SETUP VALIDATOR
 * 
 * Run this to check if everything is configured correctly
 * Usage: node test-setup.js
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const checks = [];

function log(status, message, detail = "") {
  const icon = status === "✓" ? "✓" : status === "✗" ? "✗" : "⚠";
  const color = status === "✓" ? "\x1b[32m" : status === "✗" ? "\x1b[31m" : "\x1b[33m";
  const reset = "\x1b[0m";

  console.log(`${color}${icon}${reset} ${message}`);
  if (detail) console.log(`  → ${detail}`);
  
  checks.push({ status, message });
}

async function runChecks() {
  console.log("\n🔍 VIRTUALS DIP-BUY JOB — VALIDATION\n");
  console.log("─".repeat(60));

  // 1. Check handler file exists
  const handlerPath = path.join(process.cwd(), "handlers/virtuals-dip-buy.js");
  if (fs.existsSync(handlerPath)) {
    log("✓", "Handler file found", handlerPath);
  } else {
    log("✗", "Handler file missing", `Expected: ${handlerPath}`);
  }

  // 2. Check config file exists
  const configPath = path.join(process.cwd(), "jobs/virtuals-dip-buy.config.ts");
  if (fs.existsSync(configPath)) {
    log("✓", "Config file found", configPath);
  } else {
    log("✗", "Config file missing", `Expected: ${configPath}`);
  }

  // 3. Check environment variables
  console.log("\n📋 ENVIRONMENT VARIABLES:");
  console.log("─".repeat(60));

  const requiredEnv = [
    "AGENT_WALLET_ADDRESS",
    "AGENT_PRIVATE_KEY",
    "ALCHEMY_API_KEY",
  ];

  const optionalEnv = [
    "DEGENCLAW_AUTH_TOKEN",
    "DISCORD_WEBHOOK_URL",
  ];

  let missingRequired = [];

  requiredEnv.forEach((key) => {
    if (process.env[key]) {
      const masked = process.env[key].substring(0, 10) + "...";
      log("✓", `${key} is set`, masked);
    } else {
      log("✗", `${key} is missing`, "Add to .env file");
      missingRequired.push(key);
    }
  });

  optionalEnv.forEach((key) => {
    if (process.env[key]) {
      log("✓", `${key} is set (optional)`, "✓ Alerts enabled");
    } else {
      log("⚠", `${key} not set (optional)`, "Alerts disabled");
    }
  });

  // 4. Validate wallet address format
  if (process.env.AGENT_WALLET_ADDRESS) {
    const addr = process.env.AGENT_WALLET_ADDRESS;
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      log("✓", "Wallet address format valid", addr.substring(0, 10) + "...");
    } else {
      log("✗", "Wallet address format invalid", "Expected: 0x + 40 hex chars");
    }
  }

  // 5. Validate private key format
  if (process.env.AGENT_PRIVATE_KEY) {
    const key = process.env.AGENT_PRIVATE_KEY;
    if (/^0x[a-fA-F0-9]{64}$/.test(key)) {
      log("✓", "Private key format valid", "✓ Looks good");
    } else {
      log("✗", "Private key format invalid", "Expected: 0x + 64 hex chars");
    }
  }

  // 6. Check for required npm packages
  console.log("\n📦 DEPENDENCIES:");
  console.log("─".repeat(60));

  const requiredPackages = [
    { name: "ethers", required: true },
    { name: "@uniswap/v3-sdk", required: true },
    { name: "node-cron", required: true },
  ];

  const optionalPackages = [
    { name: "@uniswap/sdk-core", required: false },
    { name: "dotenv", required: false },
  ];

  const allPackages = [...requiredPackages, ...optionalPackages];

  for (const pkg of allPackages) {
    try {
      require.resolve(pkg.name);
      const label = pkg.required ? "" : " (optional)";
      log("✓", `${pkg.name}${label} installed`, "");
    } catch {
      if (pkg.required) {
        log("✗", `${pkg.name} NOT installed`, `Run: npm install ${pkg.name}`);
      } else {
        log("⚠", `${pkg.name} not installed (optional)`, `Run: npm install ${pkg.name}`);
      }
    }
  }

  // 7. Test API connectivity
  console.log("\n🌐 API CONNECTIVITY:");
  console.log("─".repeat(60));

  try {
    console.log("  Testing CoinGecko API...");
    const response = await fetch(
      "https://api.coingecko.com/api/v3/ping"
    );
    if (response.ok) {
      log("✓", "CoinGecko API reachable", "");
    } else {
      log("✗", "CoinGecko API failed", `Status: ${response.status}`);
    }
  } catch (err) {
    log("✗", "CoinGecko API unreachable", err.message);
  }

  if (process.env.ALCHEMY_API_KEY) {
    try {
      console.log("  Testing Alchemy API...");
      const response = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        { method: "POST", body: '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' }
      );
      if (response.ok || response.status === 400) {
        log("✓", "Alchemy API reachable", "");
      } else {
        log("✗", "Alchemy API failed", `Status: ${response.status}`);
      }
    } catch (err) {
      log("✗", "Alchemy API unreachable", err.message);
    }
  }

  // 8. Summary
  console.log("\n" + "─".repeat(60));
  const passed = checks.filter(c => c.status === "✓").length;
  const failed = checks.filter(c => c.status === "✗").length;
  const warned = checks.filter(c => c.status === "⚠").length;

  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${warned} warnings\n`);

  if (failed === 0 && missingRequired.length === 0) {
    console.log("✅ ALL CHECKS PASSED — Ready to deploy!\n");
    console.log("Next steps:");
    console.log("  1. Test in dry-run: node handlers/virtuals-dip-buy.js");
    console.log("  2. Enable in config: DRY_RUN = false");
    console.log("  3. Register with scheduler");
    console.log("  4. Monitor logs\n");
    process.exit(0);
  } else if (failed === 0 && missingRequired.length > 0) {
    console.log("⚠️  WARNINGS: Add missing env vars to proceed\n");
    console.log(`Missing: ${missingRequired.join(", ")}\n`);
    process.exit(1);
  } else {
    console.log("❌ ERRORS DETECTED: Fix above before deploying\n");
    process.exit(1);
  }
}

runChecks().catch(err => {
  console.error("\n❌ Setup check failed:", err);
  process.exit(1);
});
