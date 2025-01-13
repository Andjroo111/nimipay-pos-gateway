<?php

namespace Nimipay\Services;

class PaymentProcessor {
    private $config;
    private $priceService;
    private $stablecoinProcessor;

    public function __construct() {
        $this->config = require __DIR__ . '/../../config/currency_config.php';
        $this->priceService = new PriceService();
        $this->stablecoinProcessor = new StablecoinProcessor();
    }

    /**
     * Validate and process a transaction
     * 
     * @param string $currency Currency code (NIM, BTC, USDC, UST)
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

        // Validate amount limits
        if ($expectedAmount < $currencyConfig['validation']['min_amount']) {
            throw new \Exception(sprintf($this->config['errors']['amount_too_low'], $currency));
        }
        if ($expectedAmount > $currencyConfig['validation']['max_amount']) {
            throw new \Exception(sprintf($this->config['errors']['amount_too_high'], $currency));
        }

        // Process transaction based on currency type
        switch ($currency) {
            case 'NIM':
                return $this->validateNimiqTransaction($txHash, $expectedAmount, $address);
            case 'BTC':
                return $this->validateBitcoinTransaction($txHash, $expectedAmount, $address);
            case 'USDC':
                return $this->stablecoinProcessor->validateUSDCTransaction($txHash, $expectedAmount, $address);
            case 'UST':
                return $this->stablecoinProcessor->validateUSTTransaction($txHash, $expectedAmount, $address);
            default:
                throw new \Exception("Unsupported currency for transaction validation");
        }
    }

    /**
     * Validate Nimiq transaction
     */
    private function validateNimiqTransaction($txHash, $expectedAmount, $address) {
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

        $tx = $response['result'];
        $confirmations = $tx['confirmations'];
        
        if ($confirmations < $this->config['currencies']['NIM']['min_confirmations']) {
            return [
                'status' => 'pending',
                'confirmations' => $confirmations,
                'required_confirmations' => $this->config['currencies']['NIM']['min_confirmations']
            ];
        }

        // Verify amount
        $receivedAmount = $tx['value'] / pow(10, $this->config['currencies']['NIM']['decimals']);
        $tolerance = pow(10, -$this->config['currencies']['NIM']['decimals']);
        
        if (abs($receivedAmount - $expectedAmount) > $tolerance) {
            throw new \Exception("Payment amount mismatch");
        }

        return [
            'status' => 'confirmed',
            'confirmations' => $confirmations,
            'amount' => $receivedAmount,
            'sender' => $tx['fromAddress']
        ];
    }

    /**
     * Validate Bitcoin transaction
     */
    private function validateBitcoinTransaction($txHash, $expectedAmount, $address) {
        $rpcEndpoint = $this->config['currencies']['BTC']['rpc_endpoint'];
        
        // Get raw transaction
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

        $tx = $response['result'];
        
        // Get current block height
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
        $txHeight = $tx['blockheight'] ?? null;
        $confirmations = $txHeight ? ($currentHeight - $txHeight + 1) : 0;

        if ($confirmations < $this->config['currencies']['BTC']['min_confirmations']) {
            return [
                'status' => 'pending',
                'confirmations' => $confirmations,
                'required_confirmations' => $this->config['currencies']['BTC']['min_confirmations']
            ];
        }

        // Verify amount
        $receivedAmount = 0;
        foreach ($tx['vout'] as $output) {
            if (isset($output['scriptPubKey']['addresses']) && 
                in_array($address, $output['scriptPubKey']['addresses'])) {
                $receivedAmount += $output['value'];
            }
        }

        $tolerance = pow(10, -$this->config['currencies']['BTC']['decimals']);
        if (abs($receivedAmount - $expectedAmount) > $tolerance) {
            throw new \Exception("Payment amount mismatch");
        }

        return [
            'status' => 'confirmed',
            'confirmations' => $confirmations,
            'amount' => $receivedAmount,
            'sender' => $tx['vin'][0]['address'] ?? null
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

    /**
     * Get transaction explorer URL
     */
    public function getExplorerUrl($currency, $txHash) {
        return sprintf(
            $this->config['currencies'][$currency]['explorer_tx_url'],
            $txHash
        );
    }

    /**
     * Estimate gas fees for USDC transactions
     */
    public function estimateGasFee($currency) {
        if ($currency === 'USDC') {
            return $this->stablecoinProcessor->estimateUSDCGasFee();
        }
        return 0; // No gas fees for other currencies
    }
}
