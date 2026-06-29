// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Imports from OpenZeppelin Contracts v5.x.
 *
 * Remix IDE: paste this file in as-is. Remix's npm resolver will automatically
 * fetch these from @openzeppelin/contracts@5 — no manual install needed.
 *
 * Hardhat / Foundry: run `npm install @openzeppelin/contracts@^5.0.0` first.
 */
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PuzzleAchievement
/// @notice ERC-721 achievement NFTs minted when a player completes a PuzzleChain puzzle.
/// @dev Deliberately minimal and storage-light: only the tokenURI is kept on-chain.
///      All rich data (image, traits, solve time, etc.) lives off-chain in the metadata
///      JSON pointed to by that URI (pinned to IPFS via Pinata in this project's mint flow).
///      Built for Monad Mainnet, fully EVM-compatible — no Monad-specific code is required.
contract PuzzleAchievement is ERC721URIStorage, Ownable {
    /// @dev Auto-incrementing token id counter. Starts at 0, so totalSupply() doubles
    /// as "the next token id" before any mint.
    uint256 private _nextTokenId;

    /// @notice Emitted every time an achievement NFT is minted.
    event AchievementMinted(address indexed to, uint256 indexed tokenId, string tokenURI);

    /// @param initialOwner Address that will own the contract (admin rights — see
    ///        `transferOwnership` / `renounceOwnership` from OZ's Ownable). This does
    ///        NOT need to be the same wallet as your app's ADMIN_WALLET env var; it only
    ///        controls this contract, not the PuzzleChain app's admin panel.
    constructor(address initialOwner)
        ERC721("PuzzleChain Achievement", "PZLC")
        Ownable(initialOwner)
    {}

    /// @notice Mint a new achievement NFT to `to`, pointing at metadata at `uri`.
    /// @dev Intentionally callable by anyone (not `onlyOwner`): in this project's mint
    ///      flow, the solver's own connected wallet calls this directly after solving a
    ///      puzzle ("Wallet confirmation" step), so they pay their own gas and the NFT
    ///      lands straight in their wallet. If you'd rather have a backend/relayer mint
    ///      on the user's behalf instead, add the `onlyOwner` modifier here and have your
    ///      server call it with the owner's key.
    /// @param to   Recipient of the NFT (the solver's wallet address).
    /// @param uri  Metadata URI, e.g. "ipfs://<metadata-cid>".
    /// @return tokenId The id of the newly minted token.
    function safeMint(address to, string memory uri) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit AchievementMinted(to, tokenId, uri);
    }

    /// @notice Total number of achievement NFTs minted so far.
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Convenience view: does `tokenId` exist?
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
