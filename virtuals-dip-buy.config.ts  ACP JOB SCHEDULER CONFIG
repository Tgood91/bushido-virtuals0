/**
 * ACP JOB SCHEDULER CONFIG
 * 
 * Add this to your acp-jobs.config.ts or agent orchestration file
 * Schedules the virtuals-dip-buy job to run every hour
 */

export const VIRTUALS_DIP_BUY_JOB = {
  // Unique job identifier
  id: "virtuals-dip-buy",

  // Cron schedule: Every hour at :00
  // "0 * * * *" = 00:00, 01:00, 02:00, ... 23:00 UTC
  cron: "0 * * * *",

  // Path to handler file (relative to job runner)
  handler: "./handlers/virtuals-dip-buy.js",

  // Job metadata
  name: "VIRTUALS Dip Buy",
  description: "Auto-swap $0.025 USDC → VIRTUALS when price drops -4% in 12 hours",
  category: "DeFi Arbitrage",
  risk: "LOW",

  // Execution settings
  timeout: 60000,              // Max 60 seconds per execution
  retries: 1,                  // Retry once on failure
  retryDelay: 5000,            // Wait 5s before retry

  // Alerts
  alerts: {
    onSuccess: {
      type: "discord",
      channel: "trading-signals",
      mention: ["@trader"],
    },
    onFailure: {
      type: "discord",
      channel: "trading-alerts",
      mention: ["@dev"],
      severity: "HIGH",
    },
  },

  // Environment variables required
  env: {
    AGENT_WALLET_ADDRESS: "process.env.AGENT_WALLET_ADDRESS",
    AGENT_PRIVATE_KEY: "process.env.AGENT_PRIVATE_KEY",
    ALCHEMY_API_KEY: "process.env.ALCHEMY_API_KEY",
  },

  // Enable/disable
  enabled: true,
};

// ──────────────────────────────────────────────────────────────────────────────
// INTEGRATION EXAMPLE: Add to your main scheduler
// ──────────────────────────────────────────────────────────────────────────────

import cron from "node-cron";
import { VIRTUALS_DIP_BUY_JOB } from "./jobs/virtuals-dip-buy.config.js";
import { executeJob } from "./handlers/virtuals-dip-buy.js";

// Register the job
export function registerVirtualsDipBuy() {
  if (!VIRTUALS_DIP_BUY_JOB.enabled) {
    console.log(`⊘ Job ${VIRTUALS_DIP_BUY_JOB.id} is disabled`);
    return;
  }

  console.log(`📌 Registering job: ${VIRTUALS_DIP_BUY_JOB.name}`);

  cron.schedule(VIRTUALS_DIP_BUY_JOB.cron, async () => {
    try {
      const result = await executeJob();
      console.log(`✓ ${VIRTUALS_DIP_BUY_JOB.name} completed:`, result);
      
      // Post alert if swap executed
      if (result.status === "success") {
        await postAlert(VIRTUALS_DIP_BUY_JOB.alerts.onSuccess, result);
      }
    } catch (error) {
      console.error(`❌ ${VIRTUALS_DIP_BUY_JOB.id} failed:`, error);
      await postAlert(VIRTUALS_DIP_BUY_JOB.alerts.onFailure, error);
    }
  });

  console.log(`✓ Job scheduled: ${VIRTUALS_DIP_BUY_JOB.cron}`);
}

// Add to main agent initialization
export function initializeAllJobs() {
  registerVirtualsDipBuy();
  // ... register other jobs
}

// ──────────────────────────────────────────────────────────────────────────────
// STANDALONE USAGE (for testing)
// ──────────────────────────────────────────────────────────────────────────────

// Run once immediately (for testing):
// node -e "import('./handlers/virtuals-dip-buy.js').then(m => m.executeJob())"

// Or with npx:
// npx ts-node handlers/virtuals-dip-buy.js
