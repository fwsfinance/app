// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FuckWallStreet is Ownable, ERC20, ERC20Capped {
  event ClaimRequestEvent(bytes32 requestId);
  event ClaimConfirmEvent(string redditUser, address ethAddress, uint256 amount);

  struct Claim {
    string redditUser;
    address ethAddress;
    uint256 amount;
    bool confirmed;
  }
  mapping(bytes32 => Claim) public claims;
  mapping(string => uint256) public claimedAmountsByUser;

  constructor()
    public
    ERC20("FuckWallStreet", "FWS")
    ERC20Capped(2750000000 * (10**uint256(18)))
  {}

  function _beforeTokenTransfer(address _from, address _to, uint256 _amount) internal override(ERC20, ERC20Capped) {
    super._beforeTokenTransfer(_from, _to, _amount);
  }

  function claimRequest(string calldata _redditUser) public payable {
    require(msg.value > 0, "Oracle call must be payed for.");
    payable(owner()).transfer(msg.value);
    bytes32 requestId = bytes32(keccak256(abi.encodePacked(_redditUser, block.timestamp)));
    claims[requestId] = Claim(_redditUser, msg.sender, 0, false);
    emit ClaimRequestEvent(requestId);
  }

  function claimConfirm(bytes32 _requestId, uint256 _amount) public onlyOwner {
    require(claims[_requestId].confirmed == false, "Claim already confirmed.");
    require(claimedAmountsByUser[claims[_requestId].redditUser] == 0, "You already claimed your airdrop.");
    claims[_requestId].amount = _amount;

    _mint(claims[_requestId].ethAddress, claims[_requestId].amount);

    claimedAmountsByUser[claims[_requestId].redditUser] += claims[_requestId].amount;
    claims[_requestId].confirmed = true;
    ClaimConfirmEvent(claims[_requestId].redditUser, claims[_requestId].ethAddress, claims[_requestId].amount);
  }
}
