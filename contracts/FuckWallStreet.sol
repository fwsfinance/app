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
  mapping(bytes32 => Claim) public claims;
  mapping(string => bool) public hasClaimed;
  address[] private mods;
  uint256[] private tierAmounts;

  constructor()
    public
    ERC20("FuckWallStreet", "FWS")
    ERC20Capped(2750000000 * 10**18)
  {
    tierAmounts.push(500 * 10**18);
    tierAmounts.push(750 * 10**18);
    tierAmounts.push(1500 * 10**18);
  }

  function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override(ERC20, ERC20Capped) {
    super._beforeTokenTransfer(_from, _to, _amount);
  }

  function claimRequest(string calldata _redditUser) public payable {
    require(msg.value > 10000 * tx.gasprice, "Oracle call must be payed for.");
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

    // mint for redditUser
    _mint(claims[_requestId].ethAddress, tierAmounts[_tier]);
    ClaimConfirmEvent(claims[_requestId].redditUser, claims[_requestId].ethAddress, claims[_requestId].tier);

    // mint bonus for owner and mods
    // owner gets 5% and mods also share 5%
    // as long as there are no mods, owner gets 10%
    uint256 fivePercent = SafeMath.div(tierAmounts[_tier], 20);
    uint256 tenPercent = SafeMath.div(tierAmounts[_tier], 10);

    if (mods.length > 0) {
      uint256 perMod = SafeMath.div(fivePercent, mods.length);
      for (uint i = 0; i < mods.length; i++) {
        _mint(mods[i], perMod);
      }
      _mint(owner(), fivePercent);
    } else {
      _mint(owner(), tenPercent);
    }

    // if requesting user was a mod then add to list of mods
    // but after above rewards distribution, so this new mod will be included
    // in the next claim but not his/her own
    if (_isMod == true) {
      mods.push(claims[_requestId].ethAddress);
    }
  }
}
