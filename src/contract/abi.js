// Minimal ABI — only what the frontend actually calls.
// For the full ABI (marketplace/explorer verification, etc.) see
// contracts/PuzzleAchievement.abi.json, or better, the exact ABI Remix
// produces when you compile the contract (Solidity Compiler tab → ABI button).
export const PUZZLE_ACHIEVEMENT_ABI = [
  "function safeMint(address to, string memory uri) external returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function exists(uint256 tokenId) external view returns (bool)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "event AchievementMinted(address indexed to, uint256 indexed tokenId, string tokenURI)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
