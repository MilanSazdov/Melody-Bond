// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IERC4337.sol";
import "./DAO.sol";

contract VotingPaymaster is IPaymaster, Ownable {
    using Address for address;

    IEntryPoint public immutable ENTRY_POINT;
    address public immutable daoContractAddress;
    bytes4 public immutable castVoteSelector;

    constructor(address _entryPoint, address _daoContract) Ownable(msg.sender) {
        ENTRY_POINT = IEntryPoint(_entryPoint);
        daoContractAddress = _daoContract;

        castVoteSelector = bytes4(keccak256("castVote(uint256,uint8)"));
    }


    function deposit() public payable {
        ENTRY_POINT.depositTo{value: msg.value}(address(this));
    }

    function withdraw(address payable to, uint256 amount) public onlyOwner {
        ENTRY_POINT.withdrawTo(to, amount);
    }

    function getDeposit() public view returns (uint256) {
        return ENTRY_POINT.balanceOf(address(this));
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    ) external view override returns (bytes memory context, uint256 validationData) {

        require(getDeposit() >= maxCost, "VotingPaymaster: Insufficient deposit");

        require(userOp.callData.length >= 4, "VotingPaymaster: Invalid callData length");

        bytes4 opSelector = bytes4(userOp.callData[0:4]);

        if (opSelector == 0xb61d27f6) {
            
            (address target, uint256 value, bytes memory innerCallData) = abi.decode(
                userOp.callData[4:],
                (address, uint256, bytes)
            );

            require(target == daoContractAddress, "VotingPaymaster: Target is not DAO");
            require(value == 0, "VotingPaymaster: Value is not zero");
            require(innerCallData.length >= 4, "VotingPaymaster: innerCallData too short");
            bytes4 innerSelector;
            assembly {
                innerSelector := shr(224, mload(add(innerCallData, 32)))
            }
            require(
                innerSelector == castVoteSelector,
                "VotingPaymaster: Not a castVote operation"
            );

            return ("", 0);
        }
        
        
        revert("VotingPaymaster: Unsupported operation");
    }

    
    function postOp(uint8 mode, bytes calldata /* context */, uint256 actualGasCost) external override {

        emit PostOp(mode, actualGasCost);
    }

    event PostOp(uint8 mode, uint256 actualGasCost);

    receive() external payable {}
}