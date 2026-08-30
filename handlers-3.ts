import type { ExecuteJobResult } from "../../../runtime/offeringTypes.js";

/**
 * Seykota Agent Job: Base Chain NFT Transfer Scanner
 *
 * Searches for ERC-721 or ERC-1155 token transfers on Base chain
 * for a given contract address and optional tokenId.
 *
 * Example request:
 * {
 *   "contract_address": "0x5C0BF08936bcCfbb6af24B4648A9fb365cAa2F4e",
 *   "token_id": "1",
 *   "token_standard": "ERC721",   // or "ERC1155" (default: ERC721)
 *   "limit": 10                   // max results (default: 25)
 * }
 */

const BASESCAN_API = "https://api.basescan.org/api";
const BASESCAN_KEY = process.env.BASESCAN_API_KEY || "";

interface Transfer {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  gasUsed: string;
  gasPrice: string;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function tsToDate(ts: string): string {
  return new Date(Number(ts) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function gweiToEth(gasUsed: string, gasPrice: string): string {
  const fee = (Number(gasUsed) * Number(gasPrice)) / 1e18;
  return fee.toFixed(6);
}

export async function executeJob(
  request: Record<string, any>
): Promise<ExecuteJobResult> {

  // ── Input normalization ──────────────────────────────────────────────────
  const contractAddress =
    request.contract_address ||
    request.address ||
    request.ca ||
    request.nft_address;

  const tokenId =
    request.token_id ||
    request.tokenId ||
    request.id ||
    null;

  const standard: "ERC721" | "ERC1155" =
    (request.token_standard || request.standard || "ERC721")
      .toUpperCase()
      .includes("1155")
      ? "ERC1155"
      : "ERC721";

  const limit = Math.min(Number(request.limit || 25), 100);

  // ── Validation ───────────────────────────────────────────────────────────
  if (!contractAddress) {
    return {
      deliverable: JSON.stringify({
        error: "contract_address is required",
        example: {
          contract_address: "0x5C0BF08936bcCfbb6af24B4648A9fb365cAa2F4e",
          token_id: "1",
          token_standard: "ERC721",
        },
      }),
    };
  }

  if (!BASESCAN_KEY) {
    return {
      deliverable: JSON.stringify({
        error: "BASESCAN_API_KEY not set in environment",
        hint: "Get a free key at https://basescan.org/myapikey",
      }),
    };
  }

  // ── Build Basescan API URL ────────────────────────────────────────────────
  // ERC-721: tokennfttx | ERC-1155: token1155tx
  const action = standard === "ERC1155" ? "token1155tx" : "tokennfttx";

  const params = new URLSearchParams({
    module: "account",
    action,
    contractaddress: contractAddress,
    page: "1",
    offset: String(limit),
    sort: "desc",
    apikey: BASESCAN_KEY,
  });

  // Filter by tokenId if provided
  if (tokenId !== null) {
    // Basescan doesn't support tokenId filter directly in API,
    // so we fetch and filter client-side
  }

  // ── Fetch transfers ───────────────────────────────────────────────────────
  let raw: Transfer[] = [];
  try {
    const res = await fetch(`${BASESCAN_API}?${params.toString()}`);
    if (!res.ok) throw new Error(`Basescan HTTP ${res.status}`);

    const json = await res.json();

    if (json.status === "0") {
      // "No transactions found" is status 0 with message NOTOK or No records
      if (
        json.message?.toLowerCase().includes("no") ||
        json.result === "No transactions found"
      ) {
        return {
          deliverable: JSON.stringify({
            contract_address: contractAddress,
            token_id: tokenId,
            token_standard: standard,
            chain: "base",
            transfers: [],
            count: 0,
            summary: `No ${standard} transfers found for contract ${shortAddr(contractAddress)}${tokenId ? ` tokenId #${tokenId}` : ""} on Base.`,
          }),
        };
      }
      throw new Error(json.message || "Basescan error");
    }

    raw = json.result as Transfer[];
  } catch (e: any) {
    return {
      deliverable: JSON.stringify({
        error: `Failed to fetch from Basescan: ${e.message}`,
        contract_address: contractAddress,
        chain: "base",
      }),
    };
  }

  // ── Filter by tokenId if requested ───────────────────────────────────────
  const filtered =
    tokenId !== null
      ? raw.filter((t) => t.tokenID === String(tokenId))
      : raw;

  // ── Shape the output ─────────────────────────────────────────────────────
  const transfers = filtered.map((t) => ({
    tx_hash: t.hash,
    block: Number(t.blockNumber),
    timestamp: tsToDate(t.timeStamp),
    from: t.from,
    to: t.to,
    token_id: t.tokenID,
    token_name: t.tokenName,
    token_symbol: t.tokenSymbol,
    gas_fee_eth: gweiToEth(t.gasUsed, t.gasPrice),
    basescan_url: `https://basescan.org/tx/${t.hash}`,
  }));

  // ── Build summary for agent readability ──────────────────────────────────
  const uniqueSenders = new Set(filtered.map((t) => t.from)).size;
  const uniqueReceivers = new Set(filtered.map((t) => t.to)).size;
  const latest = transfers[0];

  const summary = transfers.length > 0
    ? `Found ${transfers.length} ${standard} transfer${transfers.length > 1 ? "s" : ""} ` +
      `for ${shortAddr(contractAddress)}${tokenId ? ` tokenId #${tokenId}` : ""} on Base. ` +
      `Most recent: ${latest.from === "0x0000000000000000000000000000000000000000" ? "MINT" : shortAddr(latest.from)} → ${shortAddr(latest.to)} ` +
      `at ${latest.timestamp}. ` +
      `${uniqueSenders} unique sender${uniqueSenders > 1 ? "s" : ""}, ${uniqueReceivers} unique receiver${uniqueReceivers > 1 ? "s" : ""}.`
    : `No transfers found for tokenId #${tokenId} at ${shortAddr(contractAddress)} on Base.`;

  // ── Return deliverable ───────────────────────────────────────────────────
  return {
    deliverable: JSON.stringify({
      chain: "base",
      chain_id: 8453,
      contract_address: contractAddress,
      token_id: tokenId,
      token_standard: standard,
      token_name: transfers[0]?.token_name || null,
      token_symbol: transfers[0]?.token_symbol || null,
      count: transfers.length,
      unique_senders: uniqueSenders,
      unique_receivers: uniqueReceivers,
      summary,
      transfers,
    }),
  };
}
