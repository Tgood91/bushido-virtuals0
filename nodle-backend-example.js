// nodle-backend-example.js
// Minimal Node.js server for handling agent swap requests via CDP

import express from 'express';
import { CoinbaseSDK } from '@coinbase/cdp-sdk';

const app = express();
app.use(express.json());

// Initialize CDP SDK (credentials loaded from environment)
const cdp = new CoinbaseSDK({
  apiKeyId: process.env.CDP_KEY_ID,
  privateKeySecret: process.env.CDP_KEY_SECRET,
  networkId: 'base-mainnet'
});

// Agent email for notifications
const AGENT_EMAIL = 'nodle_micro-swaps@agents.world';

/**
 * POST /api/swap
 * Executes a micro-swap via CDP + Aerodrome
 */
app.post('/api/swap', async (req, res) => {
  try {
    const { amount, fromToken, toToken, network, notificationEmail } = req.body;

    // Validate inputs
    if (!amount || !fromToken || !toToken) {
      return res.status(400).json({ error: 'Missing swap parameters' });
    }

    // Get or create wallet
    const wallet = await cdp.wallets.list().then(w => w.data[0]);
    if (!wallet) {
      return res.status(500).json({ error: 'No wallet found' });
    }

    // Check balance before swap
    const balance = await wallet.getBalance(fromToken);
    console.log(`Wallet balance: ${balance} ${fromToken}`);

    if (parseFloat(balance) < parseFloat(amount)) {
      const msg = `Insufficient ${fromToken}. Have: ${balance}, Need: ${amount}`;
      console.log(msg);
      return res.status(402).json({ error: msg, stopExecution: true });
    }

    // Execute swap via Aerodrome on Base
    // Using CDP's swap/exchange pattern
    const swap = await wallet.swap({
      amount: amount,
      from_asset: fromToken,
      to_asset: toToken,
      network: network || 'base-mainnet',
      // Aerodrome as venue
      venue: 'aerodrome',
      mirrorUrl: 'https://aero.drome.eth.limo' // Primary mirror
    });

    const txHash = swap.transaction_hash;
    const status = swap.status;

    // Send confirmation email to agent
    await sendNotification({
      to: notificationEmail || AGENT_EMAIL,
      subject: `✓ Swap Executed: 0.05 ${fromToken} → ${toToken}`,
      body: `
Transaction Hash: ${txHash}
Status: ${status}
Amount: ${amount} ${fromToken}
Timestamp: ${new Date().toISOString()}
Network: ${network}
      `
    });

    return res.json({
      transactionHash: txHash,
      status: status,
      amountSwapped: amount,
      fromToken: fromToken,
      toToken: toToken,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Swap error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/balance/:token
 * Check wallet balance before agent schedules next swap
 */
app.get('/api/balance/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const wallet = await cdp.wallets.list().then(w => w.data[0]);
    const balance = await wallet.getBalance(token);
    
    return res.json({
      token: token,
      balance: balance,
      canSwap: parseFloat(balance) >= 0.05
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/check-funds
 * Agent calls this to see if it should continue scheduling swaps
 */
app.post('/api/check-funds', async (req, res) => {
  try {
    const wallet = await cdp.wallets.list().then(w => w.data[0]);
    const usdc_balance = await wallet.getBalance('USDC');
    const hasFunds = parseFloat(usdc_balance) >= 0.05;

    if (!hasFunds) {
      console.log(`Funds exhausted: ${usdc_balance} USDC remaining`);
      await sendNotification({
        to: AGENT_EMAIL,
        subject: '⚠️ Micro-swaps halted: Insufficient funds',
        body: `USDC balance: ${usdc_balance}. Below minimum swap amount of 0.05.`
      });
    }

    return res.json({
      usdc_balance: usdc_balance,
      hasFunds: hasFunds,
      nextSwapTime: hasFunds ? new Date(Date.now() + 4 * 60 * 60 * 1000) : null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Email notification helper
 * In production, integrate with SendGrid, AWS SES, or Telegram
 */
async function sendNotification({ to, subject, body }) {
  console.log(`📧 Email to ${to}: ${subject}`);
  console.log(body);
  
  // TODO: Integrate with actual email service
  // For now, just logs. Options:
  // - SendGrid API
  // - AWS SES
  // - Telegram bot (if agent has Telegram)
  // - Webhooks to Virtuals Protocol
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Nodle Micro-Swaps Backend running on port ${PORT}`);
  console.log(`Agent: ${AGENT_EMAIL}`);
  console.log(`Swap: 0.05 USDC → VIRTUAL every 4 hours`);
});
