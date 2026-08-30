// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// ─────────────────────────────────────────────────────────────
//  IZoraFactory.sol
//
//  Interface for the live ZoraFactory contract (Zora Coins /
//  ERC20z protocol), deployed at the same address across all
//  supported chains:
//
//    Base          (8453)  : 0x777777751622c0d3258f214F9DF38E35BF45baF3
//    Base Sepolia  (84532) : 0x777777751622c0d3258f214F9DF38E35BF45baF3
//
//  ZoraFactory is an upgradeable proxy (EIP-1967 transparent
//  proxy). Deployed coins themselves are immutable once created.
//
//  Source of truth: https://docs.zora.co/coins/contracts/factory
// ─────────────────────────────────────────────────────────────

/// @dev Minimal Uniswap V4 PoolKey struct, as referenced by the
///      V4 coin-creation events. Included here for ABI completeness
///      when decoding CoinCreatedV4 / CreatorCoinCreated / TrendCoinCreated.
struct PoolKey {
    address currency0;
    address currency1;
    uint24  fee;
    int24   tickSpacing;
    address hooks;
}

interface IZoraFactory {
    // ─── Errors ────────────────────────────────────────────────
    error AddressZero();
    error InvalidPoolConfig();
    error EthTransferInvalid();
    error CoinAlreadyDeployed(address coin);

    // ─── Events ────────────────────────────────────────────────

    /// @notice Emitted for legacy (V3) coin deployments.
    event CoinCreated(
        address indexed caller,
        address indexed payoutRecipient,
        address indexed platformReferrer,
        address currency,
        string  uri,
        string  name,
        string  symbol,
        address coin,
        address pool,
        string  version
    );

    /// @notice Emitted for Content Coins deployed on Uniswap V4.
    event CoinCreatedV4(
        address indexed caller,
        address indexed payoutRecipient,
        address indexed platformReferrer,
        address currency,
        string  uri,
        string  name,
        string  symbol,
        address coin,
        PoolKey poolKey,
        bytes32 poolKeyHash,
        string  version
    );

    /// @notice Emitted for Creator Coins (ZORA-backed) on Uniswap V4.
    event CreatorCoinCreated(
        address indexed caller,
        address indexed payoutRecipient,
        address indexed platformReferrer,
        address currency,
        string  uri,
        string  name,
        string  symbol,
        address coin,
        PoolKey poolKey,
        bytes32 poolKeyHash,
        string  version
    );

    /// @notice Emitted for Trend Coins — simplified creation flow,
    ///         unique case-insensitive ticker, no creator/referrer params.
    event TrendCoinCreated(
        address indexed caller,
        string  symbol,
        address coin,
        PoolKey poolKey,
        bytes32 poolKeyHash,
        bytes   poolConfig,
        string  version
    );

    // ─── Core Deployment ───────────────────────────────────────

    /// @notice Deploy a new Content/Creator coin with full control over
    ///         pool configuration and post-deploy hooks.
    /// @dev    msg.sender is recorded as the coin's creator.
    /// @param  payoutRecipient     Receives creator rewards from trading activity.
    /// @param  owners              Addresses permitted to manage payout/metadata.
    /// @param  uri                 Metadata URI (IPFS recommended).
    /// @param  name                Human-readable coin name.
    /// @param  symbol              Trading symbol (ticker).
    /// @param  poolConfig          Encoded pool/version/currency configuration —
    ///                             see CoinConfigurationVersions for layout.
    /// @param  platformReferrer    Receives platform referral rewards. address(0) for none.
    /// @param  postDeployHook      Optional contract called after deployment. address(0) for none.
    /// @param  postDeployHookData  Calldata forwarded to postDeployHook.
    /// @param  coinSalt            Salt enabling deterministic address prediction.
    /// @return coin                    The deployed coin's address.
    /// @return postDeployHookDataOut   Any data returned by the post-deploy hook.
    function deploy(
        address payoutRecipient,
        address[] memory owners,
        string memory uri,
        string memory name,
        string memory symbol,
        bytes memory poolConfig,
        address platformReferrer,
        address postDeployHook,
        bytes calldata postDeployHookData,
        bytes32 coinSalt
    ) external payable returns (address coin, bytes memory postDeployHookDataOut);

    /// @notice Deploy a Creator Coin (ZORA-backed, vesting-enabled).
    /// @dev    Only the first coin created by a given address is treated
    ///         as that address's "official" creator coin by the indexer.
    function deployCreatorCoin(
        address payoutRecipient,
        address[] memory owners,
        string memory uri,
        string memory name,
        string memory symbol,
        bytes memory poolConfig,
        address platformReferrer,
        bytes32 coinSalt
    ) external returns (address);

    /// @notice Deploy a Trend Coin — ZORA-backed, pre-configured multi-curve
    ///         pool, 0.01% fee, unique case-insensitive ticker.
    function deployTrendCoin(
        string calldata symbol,
        address postDeployHook,
        bytes calldata postDeployHookData
    ) external payable returns (address coin, bytes memory postDeployHookDataOut);

    // ─── Address Prediction ──────────────────────────────────────

    /// @notice Predict the deployment address of a Content/Creator coin
    ///         before calling deploy(). Useful for deterministic integrations.
    function coinAddress(
        address msgSender,
        string memory name,
        string memory symbol,
        bytes memory poolConfig,
        address platformReferrer,
        bytes32 coinSalt
    ) external view returns (address);

    /// @notice Predict the deployment address of a Trend Coin from its ticker.
    ///         Trend Coin addresses are deterministic based solely on symbol.
    function trendCoinAddress(string calldata symbol) external view returns (address);

    // ─── Metadata ──────────────────────────────────────────────

    function contractName() external pure returns (string memory);
    function contractURI() external pure returns (string memory);
    function implementation() external view returns (address);
}
