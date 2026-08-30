# Nodle Micro-Swaps Agent — Backend Setup

## Task Overview
**Job:** 3×day micro  
**Frequency:** Every 4 hours (3 executions per day)  
**Action:** Swap 0.05 USDC → ETH on Base network via Aerodrome  
**Agent Email:** `nodle_micro-swaps@agents.world`

---

## What Happens Every 4 Hours

1. Agent triggers scheduled task
2. Backend receives request: "Swap 0.05 BASE_USDC for VIRTUAL"
3. Backend queries Aerodrome via:
   - `https://aero.drome.eth.limo` (primary)
   - `https://aero.drome.eth.link` (fallback)
4. CDP backend:
   - **Encodes** swap transaction (EVM)
   - **Signs** with wallet private key (in Trusted Execution Environment)
   - **Sends** to Base network
5. Confirmation email sent to `nodle_micro-swaps@agents.world`
6. Loop repeats until wallet USDC balance < 0.05

---

## Backend Requirements

### Credentials (Stored Once)
- **CDP API Key** (key ID + secret) — from Coinbase Developer Portal
- **Wallet Secret** — for signing transactions

### Node.js Endpoint
Your backend needs to expose:

```
POST /api/swap
Content-Type: application/json

{
  "amount": "0.05",
  "fromToken": "USDC",
  "toToken": "ETH",
  "network": "base",
  "venue": "aerodrome",
  "notificationEmail": "nodle_micro-swaps@agents.world"
}
```

### Response
```json
{
  "transactionHash": "0x...",
  "status": "success",
  "amountSwapped": "0.05",
  "timestamp": "2025-06-10T12:00:00Z"
}
```

---

## Stop Condition
Task automatically stops requesting swaps when:
- Wallet USDC balance falls below 0.05
- Agent checks balance before each scheduled execution
- Notification sent to agent email when funds exhausted

---

## Deployment Checklist

- [ ] Backend with Node.js + CDP SDK running (VPS or old phone via Termux)
- [ ] CDP API key + wallet secret configured
- [ ] `/api/swap` endpoint responding to POST requests
- [ ] Aerodrome mirror URLs tested (primary + fallback)
- [ ] Email notifications configured to `nodle_micro-swaps@agents.world`
- [ ] Task JSON uploaded to agent on Virtuals
- [ ] Test swap executed manually (before 60-day auto-execution starts)

---

## Token Addresses (Base)

- **USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **VIRTUAL:** `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`

---

## Network: Base
- Chain ID: 8453
- RPC: `https://mainnet.base.org`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- VIRTUAL: `0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b`
- Aerodrome DEX: `https://aerodrome.finance`

---

## Notes
- Each swap is ~0.05 USDC worth of VIRTUAL tokens
- 3 per day = 0.15 USDC/day burn rate
- With 7 free days on Virtuals: ~1.05 USDC test budget
- After free tier: runs indefinitely until USDC funds gone
- All swaps logged to agent email for audit trail
- VIRTUAL token accumulates in agent wallet as swaps execute
