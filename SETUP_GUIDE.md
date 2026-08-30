# VIRTUALS Dip-Buy Job — Setup Guide

**What This Does:**
- Every hour, checks if BASE_VIRTUALS price dropped -4% or more in the last 12 hours
- If yes: automatically swaps $0.025 USDC → VIRTUALS
- Posts result to degen.virtuals.io
- All trades logged with TX hash

**Time to Deploy:** 5 min (copy files + set env vars)

---

## 1️⃣ FILE PLACEMENT

```
your-acp-agent/
├── handlers/
│   └── virtuals-dip-buy.js          ← Copy main job file here
├── jobs/
│   └── virtuals-dip-buy.config.ts   ← Copy config here
└── .env                               ← Add required secrets
```

**Copy these files:**
```bash
cp virtuals-dip-buy.js your-acp-agent/handlers/
cp virtuals-dip-buy.config.ts your-acp-agent/jobs/
```

---

## 2️⃣ ENVIRONMENT VARIABLES

Add to your `.env` file:

```env
# Required for wallet & trading
AGENT_WALLET_ADDRESS=0x...your_wallet_address...
AGENT_PRIVATE_KEY=0x...your_private_key_hex...

# Required for price history (get free key from Alchemy)
ALCHEMY_API_KEY=alchemy_xxx...

# Optional: For degen.virtuals.io posting
DEGENCLAW_AUTH_TOKEN=...

# Optional: Discord alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

**Getting these:**
- `AGENT_WALLET_ADDRESS` + `AGENT_PRIVATE_KEY`: Your ACP agent's wallet (should already exist)
- `ALCHEMY_API_KEY`: Free from https://www.alchemy.com (takes 2 min to sign up)
- `DEGENCLAW_AUTH_TOKEN`: From `dgclaw config` if already installed

---

## 3️⃣ TEST MODE (SAFE)

Before running with real money, test in **dry-run mode**:

### Open `handlers/virtuals-dip-buy.js` and set:
```javascript
DRY_RUN: true,  // ← Change from false to true (line 30)
```

### Run the test:
```bash
# One-time test
node handlers/virtuals-dip-buy.js

# Or if using TypeScript:
npx ts-node handlers/virtuals-dip-buy.js
```

### Expected output (dry-run):
```
📍 [2025-01-15T14:32:45Z] JOB: virtuals-dip-buy
────────────────────────────────────────────────────────────────
📊 VIRTUALS Price: $2.15 (12h: $2.24)
📉 Change: -3.92% over 12h
✗ No trigger (-3.92% > -4%)
```

✓ If you see this → everything is working!

---

## 4️⃣ ENABLE LIVE TRADING

Once dry-run looks good:

### In `handlers/virtuals-dip-buy.js`, change:
```javascript
DRY_RUN: false,  // ← Change from true to false
```

### In `jobs/virtuals-dip-buy.config.ts`, ensure:
```javascript
enabled: true,  // ← Should be true
```

---

## 5️⃣ REGISTER WITH ACP SCHEDULER

In your main agent initialization file (e.g., `agent.ts` or `index.js`):

```typescript
import { registerVirtualsDipBuy } from "./jobs/virtuals-dip-buy.config.js";

// In your agent startup function:
async function initializeAgent() {
  // ... other setup ...
  
  registerVirtualsDipBuy();  // ← Add this line
  
  console.log("✓ Agent initialized");
}
```

Or add to your cron job registry:

```typescript
const AGENT_JOBS = [
  // ... other jobs ...
  {
    id: "virtuals-dip-buy",
    cron: "0 * * * *",
    handler: "./handlers/virtuals-dip-buy.js",
  },
];
```

---

## 6️⃣ MONITOR EXECUTION

### Check logs:
```bash
# Follow live logs
tail -f logs/agent.log | grep virtuals-dip-buy

# Or if using pm2:
pm2 logs seykota-agent
```

### Expected log output when trigger hits:
```
✓ TRIGGER HIT: -4.05% ≤ -4.00%
💵 USDC Balance: $0.15
🔄 Executing swap...
✓ SWAP EXECUTED
  TX Hash: 0x1234...
  Expected Output: 0.0116 VIRTUALS
📤 Signal posted to degen.virtuals.io
```

---

## 7️⃣ ADJUST PARAMETERS (OPTIONAL)

All config values are at the top of `virtuals-dip-buy.js`:

```javascript
const CONFIG = {
  SWAP_AMOUNT_USD: 0.025,      // ← Change swap size here
  PRICE_DROP_THRESHOLD: -0.04, // ← Change -4% to something else
  LOOKBACK_HOURS: 12,          // ← Change 12hr lookback
  CHECK_INTERVAL: "0 * * * *", // ← Change frequency (see cron syntax below)
  
  MAX_SLIPPAGE_PCT: 0.01,      // ← Max acceptable price slippage
  DRY_RUN: false,              // ← Toggle dry-run
  POST_TO_DEGEN: true,         // ← Post signals to degen.virtuals.io
};
```

**Common cron patterns:**
- `"0 * * * *"` = Every hour
- `"0 */6 * * *"` = Every 6 hours
- `"0 0 * * *"` = Daily at midnight UTC
- `"*/30 * * * *"` = Every 30 minutes

---

## 8️⃣ EMERGENCY DISABLE

If something goes wrong:

### Option 1: Quick disable
In `jobs/virtuals-dip-buy.config.ts`:
```javascript
enabled: false,  // ← Disables job immediately
```

### Option 2: Kill the job process
```bash
# If running under pm2
pm2 stop seykota-agent

# Or just restart
pm2 restart seykota-agent
```

---

## 9️⃣ TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "ALCHEMY_API_KEY not set" | Add to `.env` file (see step 2) |
| "Insufficient balance" | Job requires minimum $0.05 USDC in wallet |
| "Token price cannot be fetched" | CoinGecko API may be down; try again in 5 min |
| "No 12h price history" | Job waits until 12h of price data exists |
| "DegenClaw command not found" | Install: `npm install -g degenclaw` |
| "Swap fails with slippage error" | Increase `MAX_SLIPPAGE_PCT` (default 1%) |

---

## 🔟 INTEGRATING WITH SEYKOTA AGENT

To add this job to your full Seykota trend-following agent:

1. **Keep this job separate** — it's a mechanical "dip buyer" independent of Seykota's main trend-following logic
2. **Allocate separate capital** — Don't compete with Seykota's position sizing
3. **Log separately** — Monitor dip-buy P&L independently
4. **Consider combining:**
   - Seykota long signal (score ≥ +5) + VIRTUALS dip-buy trigger = **extra confirmation**
   - Only execute dip-buy if Seykota is not in a short position on VIRTUALS

---

## 📊 SUCCESS CRITERIA

✓ Job is working when:
1. Runs every hour without errors
2. Logs show "No trigger" most of the time (normal)
3. When price drops -4%+, you see "TRIGGER HIT"
4. Swap executes with a TX hash
5. Signal posts to degen.virtuals.io

---

## 🔗 NEXT STEPS

- [ ] Set env variables
- [ ] Copy files to handlers/ and jobs/
- [ ] Test in dry-run mode
- [ ] Enable live trading
- [ ] Register with ACP scheduler
- [ ] Monitor logs for 24h
- [ ] Adjust swap amount if needed

**Questions?** Check handler file comments — every function is documented.
