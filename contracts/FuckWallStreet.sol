// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FuckWallStreet is Ownable, ERC20, ERC20Capped {
  event ClaimRequestEvent(string redditUser, address ethAddress);
  event ClaimConfirmEvent(string redditUser, address ethAddress, uint256 amount);
  mapping(string => uint) public claims;

  constructor()
    public
    ERC20("FuckWallStreet", "FWS")
    ERC20Capped(2750000000 * (10**uint256(18)))
  {}

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Capped) {
    super._beforeTokenTransfer(from, to, amount);
  }

  function claimRequest(string calldata redditUser) public payable {
    require(msg.value > 0, "Oracle call must be payed for.");
    emit ClaimRequestEvent(redditUser, msg.sender);
  }

  function claimConfirm(string calldata _redditUser, address _ethAddress, uint256 _amount) public onlyOwner {
    _mint(_ethAddress, _amount);
    ClaimConfirmEvent(_redditUser, _ethAddress, _amount);
  }
}
