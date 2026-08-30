// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ERC1155Faucet
 * @notice Users must hold or spend a required amount of a specific ERC20 token
 *         in order to claim ERC1155 tokens from this faucet.
 *
 * Two modes are supported (set per token ID by the owner):
 *   - HOLD mode  : user must currently hold >= requiredAmount of ERC20 (no transfer).
 *   - BURN mode  : requiredAmount of ERC20 is transferred from the user to this
 *                  contract (acting as a burn sink / treasury) on each claim.
 *
 * Each (user, tokenId) pair is subject to a cooldown period between claims.
 */
contract ERC1155Faucet is ERC1155, Ownable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum GateMode { HOLD, BURN }

    struct TokenConfig {
        uint256 requiredERC20Amount; // ERC20 balance / cost required
        uint256 mintAmount;          // How many ERC1155 tokens minted per claim
        uint256 cooldown;            // Seconds between claims per wallet
        uint256 maxSupply;           // 0 = unlimited
        uint256 totalMinted;         // Running tally
        GateMode mode;               // HOLD or BURN
        bool active;                 // Faucet on/off switch per token ID
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20 public immutable gateToken;  // The ERC20 used as the gate

    /// tokenId => TokenConfig
    mapping(uint256 => TokenConfig) public tokenConfigs;

    /// tokenId => wallet => last claim timestamp
    mapping(uint256 => mapping(address => uint256)) public lastClaimed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TokenConfigSet(
        uint256 indexed tokenId,
        uint256 requiredAmount,
        uint256 mintAmount,
        uint256 cooldown,
        uint256 maxSupply,
        GateMode mode
    );
    event Claimed(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TokenActiveToggled(uint256 indexed tokenId, bool active);
    event ERC20Withdrawn(address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _gateToken  Address of the ERC20 token used as the gate.
     * @param _uri        Base URI for ERC1155 metadata (supports {id} substitution).
     */
    constructor(address _gateToken, string memory _uri)
        ERC1155(_uri)
        Ownable(msg.sender)
    {
        require(_gateToken != address(0), "Faucet: zero address");
        gateToken = IERC20(_gateToken);
    }

    // -------------------------------------------------------------------------
    // Owner configuration
    // -------------------------------------------------------------------------

    /**
     * @notice Create or update the faucet config for a given ERC1155 token ID.
     * @param tokenId           The ERC1155 token ID to configure.
     * @param requiredAmount    ERC20 amount required (18-decimal units, or token's own decimals).
     * @param mintAmount        Number of ERC1155 tokens issued per successful claim.
     * @param cooldown          Minimum seconds between two claims for the same wallet.
     * @param maxSupply         Total cap on minted supply (0 = no cap).
     * @param mode              HOLD (0) or BURN (1).
     */
    function setTokenConfig(
        uint256 tokenId,
        uint256 requiredAmount,
        uint256 mintAmount,
        uint256 cooldown,
        uint256 maxSupply,
        GateMode mode
    ) external onlyOwner {
        require(mintAmount > 0, "Faucet: mintAmount must be > 0");

        TokenConfig storage cfg = tokenConfigs[tokenId];
        cfg.requiredERC20Amount = requiredAmount;
        cfg.mintAmount          = mintAmount;
        cfg.cooldown            = cooldown;
        cfg.maxSupply           = maxSupply;
        cfg.mode                = mode;
        cfg.active              = true;   // auto-activate on (re)configure

        emit TokenConfigSet(tokenId, requiredAmount, mintAmount, cooldown, maxSupply, mode);
    }

    /**
     * @notice Pause or resume the faucet for a specific token ID.
     */
    function setTokenActive(uint256 tokenId, bool active) external onlyOwner {
        tokenConfigs[tokenId].active = active;
        emit TokenActiveToggled(tokenId, active);
    }

    /**
     * @notice Update the ERC1155 metadata URI.
     */
    function setURI(string memory newUri) external onlyOwner {
        _setURI(newUri);
    }

    /**
     * @notice Withdraw accumulated ERC20 (collected in BURN mode) to any address.
     */
    function withdrawERC20(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Faucet: zero address");
        require(gateToken.transfer(to, amount), "Faucet: transfer failed");
        emit ERC20Withdrawn(to, amount);
    }

    // -------------------------------------------------------------------------
    // Public view helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Returns whether a given wallet is currently eligible to claim tokenId.
     * @return eligible  True if all conditions pass.
     * @return reason    Human-readable reason when not eligible.
     */
    function checkEligibility(address user, uint256 tokenId)
        public
        view
        returns (bool eligible, string memory reason)
    {
        TokenConfig storage cfg = tokenConfigs[tokenId];

        if (!cfg.active) {
            return (false, "Faucet: token not active");
        }

        if (cfg.maxSupply > 0 && cfg.totalMinted + cfg.mintAmount > cfg.maxSupply) {
            return (false, "Faucet: max supply reached");
        }

        uint256 nextAllowed = lastClaimed[tokenId][user] + cfg.cooldown;
        if (block.timestamp < nextAllowed) {
            return (false, "Faucet: cooldown not elapsed");
        }

        uint256 userBalance = gateToken.balanceOf(user);
        if (userBalance < cfg.requiredERC20Amount) {
            return (false, "Faucet: insufficient ERC20 balance");
        }

        if (cfg.mode == GateMode.BURN) {
            uint256 allowance = gateToken.allowance(user, address(this));
            if (allowance < cfg.requiredERC20Amount) {
                return (false, "Faucet: insufficient ERC20 allowance");
            }
        }

        return (true, "");
    }

    /**
     * @notice Returns seconds remaining until the user can claim again (0 if ready).
     */
    function cooldownRemaining(address user, uint256 tokenId)
        external
        view
        returns (uint256)
    {
        uint256 nextAllowed = lastClaimed[tokenId][user] + tokenConfigs[tokenId].cooldown;
        if (block.timestamp >= nextAllowed) return 0;
        return nextAllowed - block.timestamp;
    }

    // -------------------------------------------------------------------------
    // Claim
    // -------------------------------------------------------------------------

    /**
     * @notice Claim ERC1155 tokens for a given token ID.
     *
     *  HOLD mode : you only need to hold the required ERC20 balance.
     *  BURN mode : `requiredERC20Amount` is pulled from your wallet into this
     *              contract. Approve this contract first.
     *
     * @param tokenId  The ERC1155 token ID to claim.
     */
    function claim(uint256 tokenId) external nonReentrant {
        (bool eligible, string memory reason) = checkEligibility(msg.sender, tokenId);
        require(eligible, reason);

        TokenConfig storage cfg = tokenConfigs[tokenId];

        // In BURN mode, take the ERC20 from the user
        if (cfg.mode == GateMode.BURN && cfg.requiredERC20Amount > 0) {
            require(
                gateToken.transferFrom(msg.sender, address(this), cfg.requiredERC20Amount),
                "Faucet: ERC20 transferFrom failed"
            );
        }

        // Record claim time before minting (CEI pattern)
        lastClaimed[tokenId][msg.sender] = block.timestamp;
        cfg.totalMinted += cfg.mintAmount;

        // Mint ERC1155
        _mint(msg.sender, tokenId, cfg.mintAmount, "");

        emit Claimed(msg.sender, tokenId, cfg.mintAmount);
    }

    /**
     * @notice Claim multiple token IDs in one transaction.
     * @param tokenIds  Array of ERC1155 token IDs to claim.
     */
    function claimBatch(uint256[] calldata tokenIds) external nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            (bool eligible, string memory reason) = checkEligibility(msg.sender, tokenId);
            require(eligible, reason);

            TokenConfig storage cfg = tokenConfigs[tokenId];

            if (cfg.mode == GateMode.BURN && cfg.requiredERC20Amount > 0) {
                require(
                    gateToken.transferFrom(msg.sender, address(this), cfg.requiredERC20Amount),
                    "Faucet: ERC20 transferFrom failed"
                );
            }

            lastClaimed[tokenId][msg.sender] = block.timestamp;
            cfg.totalMinted += cfg.mintAmount;

            _mint(msg.sender, tokenId, cfg.mintAmount, "");
            emit Claimed(msg.sender, tokenId, cfg.mintAmount);
        }
    }
}
