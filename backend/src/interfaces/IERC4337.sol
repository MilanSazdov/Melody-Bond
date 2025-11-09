// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint {
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
    function getSenderAddress(bytes calldata initCode) external view returns (address);
}

interface IPaymaster {
    enum PostOpMode {
        opSuccess,
        opRevert
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 requiredPreFund
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external;
}