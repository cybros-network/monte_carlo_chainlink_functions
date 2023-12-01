// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/resources/link-token-contracts/
 */

/**
 * @title MonteCarloFunctionsConsumer
 * @notice This is a simple contract to show how to make HTTP requests using Chainlink
 * @dev This contract uses hardcoded values and should not be used in production.
 */
contract MonteCarloFunctionsConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    uint32 public constant MAX_CALLBACK_GAS = 70_000;

    // State variables to store the last request ID, response, and error
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    // State variable to store the returned txHash
    string public remoteTxHash;

    // Custom error type
    error UnexpectedRequestID(bytes32 requestId);

    // Event to log responses
    event Response(
        bytes32 indexed requestId,
        string remoteTxHash,
        bytes response,
        bytes err
    );

    // Router address - Hardcoded for Mumbai
    // Check to get the router address for your supported network https://docs.chain.link/chainlink-functions/supported-networks
    address router = 0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C;

    // donID - Hardcoded for Mumbai
    // Check to get the donID for your supported network https://docs.chain.link/chainlink-functions/supported-networks
    bytes32 donID =
        0x66756e2d706f6c79676f6e2d6d756d6261692d31000000000000000000000000;

    // JavaScript source code
    string source =
        "const data = JSON.parse(args[1]);"
        "const dataHashHex = args[2];"
        "const apiRequest = Functions.makeHttpRequest({"
        "url: 'https://forwarder-dev.monte-carlo.ai/submit',"
        "method: 'POST',"
        "headers: {"
        "'Content-Type': 'application/json',"
        "'Access-Control-Allow-Origin': '*'"
        "},"
        "data: {"
        "unique_track_id: dataHashHex,"
        "data"
        "}"
        "});"
        "const apiResponse = await apiRequest;"
        "if (apiResponse.error) {"
        "console.error(apiResponse.error);"
        "throw Error('Request failed');"
        "}"
        "return Functions.encodeString(apiResponse.data.txHash);";

    /**
     * @notice Initializes the contract with the Chainlink router address and sets the contract owner
     */
    constructor() FunctionsClient(router) ConfirmedOwner(msg.sender) {}

    /**
     * @notice Callback function for fulfilling a request
     * @param requestId The ID of the request to fulfill
     * @param response The HTTP response data
     * @param err Any errors from the Functions request
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId); // Check if request IDs match
        }
        // Update the contract's state variables with the response and any errors
        s_lastResponse = response;
        remoteTxHash = string(response);
        s_lastError = err;

        // Emit an event to log the response
        emit Response(requestId, remoteTxHash, s_lastResponse, s_lastError);
    }

    // Our own logic

    // The event for a prompt requested
    event PromptRequested(
        address indexed sender,
        uint256 fee,
        string input,
        bytes publicKey
    );

    // The minimum fee for requesting a prompt
    uint256 public minAmount = 0.001 ether;

    function setMinAmount(uint256 _minAmount) public onlyOwner {
        minAmount = _minAmount;
    }

    // The Chainlink Functions' subscription id
    uint64 public subscriptionId = 1047;

    function setSubscriptionId(uint64 _subscriptionId) public onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function sendRequest(
        string[] calldata args
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source); // Initialize the request with JS code
        if (args.length > 0) req.setArgs(args); // Set the arguments for the request

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            MAX_CALLBACK_GAS,
            donID
        );

        return s_lastRequestId;
    }

    function simplePrompt(
        string[] calldata args
    ) external payable returns (bytes32 requestId) {
        require(
            msg.value >= minAmount,
            "Amount is less than the minimum required"
        );

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        if (args.length > 0) req.setArgs(args);

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            MAX_CALLBACK_GAS,
            donID
        );

        return s_lastRequestId;
    }

    function prompt(
        string calldata _input,
        string calldata length,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        bytes calldata _publicKey
    ) external payable returns (bytes32 requestId) {
        require(
            msg.value >= minAmount,
            "Amount is less than the minimum required"
        );
        require(
            msg.sender == address(uint160(uint256(keccak256(_publicKey)))),
            "Public key mismatched"
        );

        bytes memory prefix = bytes(
            string.concat("\x19Ethereum Signed Message:\n", length)
        );
        bytes32 inputHash = keccak256(abi.encodePacked(prefix, _input));
        address signer = ecrecover(inputHash, _v, _r, _s);
        require(
            signer != address(0) && signer == msg.sender,
            "ECDSA: invalid signature"
        );

        emit PromptRequested(msg.sender, msg.value, _input, _publicKey);

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        string[] memory args = new string[](3);
        args[0] = string(_publicKey);
        args[1] = _input;
        args[2] = string(abi.encode(keccak256(abi.encode(_input))));
        req.setArgs(args);

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            MAX_CALLBACK_GAS,
            donID
        );

        return s_lastRequestId;
    }
}
