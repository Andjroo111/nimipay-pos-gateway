<?php

namespace Nimipay\Services;

class PaymentProcessor {
    private $config;
    private $priceService;

    public function __construct() {
        $this->config = require __DIR__ . '/../../config/currency_config.php';
        $this->priceService = new PriceService();
    }

    /**
     * Validate and process a transaction
     * 
     * @param string $currency Currency code (NIM, BTC)
     * @param string $txHash Transaction hash
     * @param string $address Sender address
     * @param float $expectedAmount Expected payment amount in crypto
     * @return array Transaction status and details
     * @throws \Exception If validation fails
     */
    public function validateTransaction($currency, $txHash, $address, $expectedAmount) {
        $currencyConfig = $this->config['currencies'][$currency] ?? null;
        if (!$currencyConfig) {
            throw new \Exception("Unsupported currency: {$currency}");
        }

        // Validate address format
        if (!preg_match($currencyConfig['validation']['address_regex'], $address)) {
            throw new \Exception(sprintf($this->config['errors']['invalid_address'], $currency));
        }

        // Get transaction details based on currency
        $txDetails = $this->getTransactionDetails($currency, $txHash);
        
        // Verify confirmations
        if ($txDetails['confirmations'] < $currencyConfig['min_confirmations']) {
            return [
                'status' => 'pending',
                'confirmations' => $txDetails['confirmations'],
                'required_confirmations' => $currencyConfig['min_confirmations']
            ];
        }

        // Verify amount (with small tolerance for floating point)
        $receivedAmount = $txDetails['amount'];
        $tolerance = pow(10, -$currencyConfig['decimals']); // One unit of smallest denomination
        if (abs($receivedAmount - $expectedAmount) > $tolerance) {
            throw new \Exception("Payment amount mismatch");
        }

        return [
            'status' => 'confirmed',
            'confirmations' => $txDetails['confirmations'],
            'amount' => $receivedAmount,
            'sender' => $txDetails['sender']
        ];
    }

    /**
     * Get transaction details from appropriate blockchain
     */
    private function getTransactionDetails($currency, $txHash) {
        switch ($currency) {
            case 'NIM':
                return $this->getNimiqTransaction($txHash);
            case 'BTC':
                return $this->getBitcoinTransaction($txHash);
            default:
                throw new \Exception("Unsupported currency for transaction verification");
        }
    }

    /**
     * Get Nimiq transaction details
     */
    private function getNimiqTransaction($txHash) {
        $rpcEndpoint = $this->config['currencies']['NIM']['rpc_endpoint'];
        
        $rpcData = [
            "jsonrpc" => "2.0",
            "method" => "getTransactionByHash",
            "params" => [$txHash],
            "id" => 1
        ];

        $response = $this->makeRpcCall($rpcEndpoint, $rpcData);
        
        if (!isset($response['result'])) {
            throw new \Exception("Failed to fetch Nimiq transaction");
        }

        return [
            'confirmations' => $response['result']['confirmations'],
            'amount' => $response['result']['value'] / pow(10, $this->config['currencies']['NIM']['decimals']),
            'sender' => $response['result']['fromAddress']
        ];
    }

    /**
     * Get Bitcoin transaction details
     */
    private function getBitcoinTransaction($txHash) {
        $rpcEndpoint = $this->config['currencies']['BTC']['rpc_endpoint'];
        
        // First get raw transaction
        $rpcData = [
            "jsonrpc" => "2.0",
            "method" => "getrawtransaction",
            "params" => [$txHash, true],
            "id" => 1
        ];

        $response = $this->makeRpcCall($rpcEndpoint, $rpcData);
        
        if (!isset($response['result'])) {
            throw new \Exception("Failed to fetch Bitcoin transaction");
        }

        // Get current block height for confirmation calculation
        $blockHeightData = [
            "jsonrpc" => "2.0",
            "method" => "getblockcount",
            "params" => [],
            "id" => 1
        ];

        $heightResponse = $this->makeRpcCall($rpcEndpoint, $blockHeightData);
        
        if (!isset($heightResponse['result'])) {
            throw new \Exception("Failed to get current block height");
        }

        $currentHeight = $heightResponse['result'];
        $txHeight = $response['result']['blockheight'] ?? null;
        $confirmations = $txHeight ? ($currentHeight - $txHeight + 1) : 0;

        // Calculate total received amount (sum of relevant outputs)
        $amount = 0;
        foreach ($response['result']['vout'] as $output) {
            // Add logic here to verify output address matches expected recipient
            $amount += $output['value'];
        }

        return [
            'confirmations' => $confirmations,
            'amount' => $amount,
            'sender' => $response['result']['vin'][0]['address'] ?? null // Simplified; might need more complex input analysis
        ];
    }

    /**
     * Make RPC call to blockchain node
     */
    private function makeRpcCall($endpoint, $data) {
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \Exception("RPC call failed: " . $error);
        }

        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Invalid JSON response from RPC");
        }

        if (isset($decoded['error']) && $decoded['error'] !== null) {
            throw new \Exception("RPC error: " . json_encode($decoded['error']));
        }

        return $decoded;
    }
}
