// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract FuckWallStreet is Ownable, ERC20, ERC20Capped {
  event ClaimRequestEvent(bytes32 requestId);
  event ClaimConfirmEvent(string redditUser, address ethAddress, uint8 tier);

  struct Claim {
    string redditUser;
    address ethAddress;
    uint8 tier;
    bool confirmed;
  }
  mapping(bytes32 => Claim) public claims; // (oracle) requestId => Claim
  mapping(string => bool) public hasClaimed; // username => bool
  address[] private mods;
  uint256[] private tierAmounts;
  uint256 public oracleFee;

  uint256 supplyCap = 2750000000 * 10**18;

  constructor()
    public
    ERC20("FuckWallStreet", "FWS")
    ERC20Capped(supplyCap)
  {
    tierAmounts.push(500 * 10**18); // 500 FWS for tier0
    tierAmounts.push(750 * 10**18); // 750 FWS for tier1
    tierAmounts.push(1500 * 10**18); // 1500 FWS for tier2
    oracleFee = 0.0008 * 10 ** 18; // 0.0008 ETH fee for each claim

    // mint 1% of total supply for owner
    _mint(owner(), SafeMath.div(supplyCap, 100));
  }

  function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override(ERC20, ERC20Capped) {
    super._beforeTokenTransfer(_from, _to, _amount);
  }

  function setOracleFee(uint256 _fee) public onlyOwner {
    oracleFee = _fee;
  }

  function claimRequest(string calldata _redditUser) public payable {
    require(hasClaimed[_redditUser] == false, "You already claimed your airdrop.");
    require(msg.value >= oracleFee, "Oracle fee must be payed.");

    // forward fee to oracle (owner) and store request
    payable(owner()).transfer(msg.value);
    bytes32 requestId = bytes32(keccak256(abi.encodePacked(_redditUser, block.timestamp)));
    claims[requestId] = Claim(_redditUser, msg.sender, 0, false);
    emit ClaimRequestEvent(requestId);
  }

  function claimConfirm(bytes32 _requestId, uint8 _tier, bool _isMod) public onlyOwner {
    require(claims[_requestId].confirmed == false, "Claim already confirmed.");

    // set tier and mark as claimed
    claims[_requestId].tier = _tier;
    claims[_requestId].confirmed = true;
    hasClaimed[claims[_requestId].redditUser] = true;

    // mint bonus for owner and mods
    // owner gets 5% and mods also share 5%
    // as long as there are no mods, owner gets 10%
    uint256 fivePercent = SafeMath.div(tierAmounts[_tier], 20);
    uint256 tenPercent = SafeMath.div(tierAmounts[_tier], 10);

    // mint (90%) for redditUser first
    _mint(claims[_requestId].ethAddress, SafeMath.sub(tierAmounts[_tier], tenPercent));
    ClaimConfirmEvent(claims[_requestId].redditUser, claims[_requestId].ethAddress, claims[_requestId].tier);

    // then mint bonus (10%)
    if (mods.length > 0) {
      uint256 perMod = SafeMath.div(fivePercent, mods.length);
      for (uint i = 0; i < mods.length; i++) {
        _mint(mods[i], perMod);
      }
      _mint(owner(), fivePercent);
    } else {
      _mint(owner(), tenPercent);
    }

    // if requesting user was a mod then add to list of mods (up to 15 mods)
    // but after above rewards distribution, so this new mod will be included
    // in the next claim but not his/her own
    if (_isMod == true && mods.length < 15) {
      mods.push(claims[_requestId].ethAddress);
    }
  }
}
