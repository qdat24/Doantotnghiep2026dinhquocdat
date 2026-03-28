// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FurnitureCertificate
 * @dev NFT Chứng nhận sở hữu nội thất - ERC721
 */
contract FurnitureCertificate is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    string private _baseTokenURI;

    constructor(string memory baseURI) ERC721("Furniture Certificate", "FNC") {
        _baseTokenURI = baseURI;
    }

    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function mint(address to) external onlyOwner returns (uint256) {
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
