# agent-infra

Central reference repo for on-chain agent infrastructure — router configuration, RPC failover, and the swap orchestrator agent that ties Seykota and Druckenmiller signals into executable trades.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐
│  Seykota Agent   │     │ Druckenmiller     │
│  (trend signals) │     │ Agent (macro/     │
│                  │     │ asymmetry signals)│
└────────┬─────────┘     └────────┬──────────┘
         │                         │
         └───────────┬─────────────┘
                      ▼
         ┌────────────────────────────┐
         │   Swap Orchestrator Agent   │
         │   - signal alignment check  │
         │   - nodle_micro-swaps       │
         │     (sub-function)          │
         │   - router failover         │
         │   - RPC failover             │
         │   - CDP execution            │
         └────────────┬────────────────┘
                       ▼
              ┌─────────────────┐
              │   Base Chain     │
              │  (via CDP wallet)│
              └─────────────────┘
```

The orchestrator does not generate its own market view. It consumes signals from Seykota (trend/EMA scoring) and Druckenmiller (macro regime + asymmetry), checks for **alignment**, and — when aligned — executes a swap via Coinbase Developer Platform (CDP) using the router/RPC failover chains defined below.

---

## Router Configuration

Routers are tried in order. If `PRIMARY_ROUTER` quote fails, reverts, or times out, the orchestrator falls back to the next router in sequence.

| Role | Address | Identity | Verified |
|---|---|---|---|
| `PRIMARY_ROUTER` | `0x111111125421cA6dc452d289314280a0f8842A65` | 1inch v5 Aggregation Router | ✓ |
| `FALLBACK_ROUTER_1` | `0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae` | LI.FI LiFi Diamond (cross-chain proxy) | ✓ |
| `FALLBACK_ROUTER_2` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | 0x Protocol-style router (Permit2/Uniswap V3) | ✓ |

All three addresses are public, verified contracts — safe to commit. See `/config/routers.json`.

### Failover logic

1. Request quote from `PRIMARY_ROUTER`
2. If quote fails or slippage exceeds tolerance → try `FALLBACK_ROUTER_1`
3. If that fails → try `FALLBACK_ROUTER_2`
4. If all three fail → abort swap, log alert, do NOT retry blindly (prevents repeated failed gas spend)

---

## RPC Configuration

### Primary Layer
| Variable | Endpoint | Type |
|---|---|---|
| `COINBASE_RPC` | `https://developer-access-mainnet.base.org` | HTTP — primary read/write |
| `TENDERLY_WSS` | `wss://base.gateway.tenderly.co` | WebSocket — real-time event/mempool monitoring |

### Fallback Layer (in order)
| Variable | Endpoint |
|---|---|
| `FALLBACK_RPC_1` | `https://1rpc.io/base` |
| `FALLBACK_RPC_2` | `https://base.api.pocket.network` |

### Failover logic

- All transaction submissions go through `COINBASE_RPC` first
- If `COINBASE_RPC` is unresponsive (timeout > 5s or 5xx) → `FALLBACK_RPC_1` → `FALLBACK_RPC_2`
- `TENDERLY_WSS` is used independently for real-time monitoring (mempool watch, pending tx alerts) — does not participate in the write-path failover chain
- Health checks run every cycle; the orchestrator logs which RPC tier served each request for debugging

---

## Data Layer

| Source | Purpose | Key Required |
|---|---|---|
| CoinGecko | Price, volume, market data | `COINGECKO_API_KEY` (free tier OK) |
| DeFiLlama | TVL, fees, DEX volume, bridges | No key |
| Basescan | NFT/token transfer history | `BASESCAN_API_KEY` |

---

## Agent Roles

### Seykota (Trend)
EMA-based trend scoring (-7 to +7). Generates LONG/SHORT/CLOSE signals per the Fresh Eyes rule. See `seykota/` for handlers.

### Druckenmiller (Macro)
Macro regime classification + asymmetry (reward/risk) scoring + concentration audit. Generates ADD/HOLD/TRIM/EXIT_NOW per position. See `druckenmiller/` for handlers.

### Swap Orchestrator (this repo's new component)
- **Mode: AUTO-EXECUTE via CDP**
- Polls both agents' latest signal output
- Requires **signal alignment**: Seykota direction must agree with Druckenmiller's `fundamental_signal` / `action` for the same asset
- On alignment, computes swap parameters and executes via CDP wallet
- `nodle_micro-swaps` runs as a scheduled sub-function — independent of signal alignment, on its fixed 4-hour USDC→VIRTUAL cycle on Aerodrome
- All swaps logged with: signal source, alignment score, router used, RPC tier used, tx hash, gas cost

See `orchestrator/` for the handler and config.

---

## Directory Structure

```
/config
  ├── routers.json        — router addresses + failover order (public, safe to commit)
  ├── rpc-config.json      — RPC endpoints + failover order (public endpoints, safe to commit)
  └── .env.example          — template for secrets (COMMIT this)
.env                         — actual API keys (GITIGNORE this — never commit)

/orchestrator
  ├── swap-orchestrator-handler.ts  — main ACP job: alignment check + CDP execution
  └── nodle-micro-swaps-handler.ts  — sub-function: scheduled USDC→VIRTUAL swaps

/seykota       — Seykota agent handlers
/druckenmiller — Druckenmiller agent handlers
```

---

## Security Notes

- `.env` is gitignored. `.env.example` contains placeholder values only.
- Router and RPC addresses in `/config/*.json` are public infrastructure — safe to version control.
- CDP wallet credentials are managed via Anthropic's EconomyOS / ACP identity layer — never stored in this repo.
- Auto-execution mode means a failed alignment check or router failure should ALWAYS fail closed (no trade), never fail open.
