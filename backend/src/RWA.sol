// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RWA is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner) 
        ERC721("RWA", "RWA") 
        Ownable(initialOwner) // Set DAO.sol as the owner
    {}

    /**
     * @dev Mints a new RWA NFT.
     * This function can only be called by the owner (the DAO.sol contract).
     * @param to The address to mint the NFT to (e.g., daoTreasury).
     * @param uri The metadata URI for the new NFT.
     * @return The ID of the new token.
     */
    
    function mint(address to, string memory uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
}