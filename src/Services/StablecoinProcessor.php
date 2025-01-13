<?php

namespace NimiPay\Services;

class StablecoinProcessor {
    private $usdcHandler;
    private $gasService;
    private $contractService;
    private $priceService;
    
    // Supported stablecoins
    private const SUPPORTED_COINS = [
        'USDC' => [
            'decimals' => 6,
            'confirmations' => [
                'mainnet' => 12,
                'testnet' => 5
            ]
        ],
        'UST' => [
            'decimals' => 6,
            'confirmations' => [
                'mainnet' => 15,
                'testnet' => 5
            ]
        ]
    ];
    
    public function __construct(
        UsdcTransactionHandler $usdcHandler,
        UstTransactionHandler $ustHandler,
        GasAbstractionService $gasService,
        ContractInteractionService $contractService,
        PriceService $priceService,
        string $network = 'mainnet'
    ) {
        $this->usdcHandler = $usdcHandler;
        $this->ustHandler = $ustHandler;
        $this->gasService = $gasService;
        $this->contractService = $contractService;
        $this->priceService = $priceService;
        $this->network = $network;
    }
    
    /**
     * Process stablecoin payment
     */
    public function processStablecoinPayment(
        string $currency,
        string $customerAddress,
        string $merchantAddress,
        int $amount,
        array $options = []
    ): array {
        try {
            // Validate currency
            if (!isset(self::SUPPORTED_COINS[$currency])) {
                throw new \Exception('Unsupported currency');
            }
            
            switch ($currency) {
                case 'USDC':
                    return $this->processUsdcPayment($customerAddress, $merchantAddress, $amount, $options);
                case 'UST':
                    return $this->processUstPayment($customerAddress, $merchantAddress, $amount, $options);
                default:
                    throw new \Exception('Unsupported currency');
            }
        } catch (\Exception $e) {
            throw new \Exception("Payment failed: " . $e->getMessage());
        }
    }

    /**
     * Process USDC payment
     */
    private function processUsdcPayment(
        string $customerAddress,
        string $merchantAddress,
        int $amount,
        array $options = []
    ): array {
        try {
            // Validate addresses
            if (!$this->contractService->validateAddress($customerAddress) ||
                !$this->contractService->validateAddress($merchantAddress)) {
                throw new \Exception('Invalid address format');
            }
            
            // Validate amount
            if ($amount <= 0) {
                throw new \Exception('Invalid amount');
            }
            
            // Check customer balance
            $balance = $this->contractService->callMethod(
                'USDC',
                'balanceOf',
                [$customerAddress]
            );
            
            if ($balance < $amount) {
                throw new \Exception('Insufficient balance');
            }
            
            // Get gas estimate
            $gasEstimate = $this->gasService->estimateGas('transferWithPermit');
            
            // Get permit signature
            $permit = $this->usdcHandler->getPermit(
                $customerAddress,
                $merchantAddress,
                $amount
            );
            
            // Execute transfer with gas abstraction
            $txHash = $this->usdcHandler->transferWithPermit(
                $customerAddress,
                $merchantAddress,
                $amount,
                $permit,
                $gasEstimate
            );
            
            // Wait for confirmations
            $confirmation = $this->contractService->waitForConfirmation(
                $txHash,
                self::SUPPORTED_COINS['USDC']['confirmations'][$this->network]
            );
            
            // Monitor gas usage
            $gasUsage = $this->gasService->monitorGasUsage($txHash);
            
            // Handle gas reimbursement if needed
            if (isset($options['relayerAddress'])) {
                try {
                    $this->gasService->handleGasReimbursement(
                        $txHash,
                        $options['relayerAddress']
                    );
                } catch (\Exception $e) {
                    // Log reimbursement failure but don't fail the transaction
                    error_log('Gas reimbursement failed: ' . $e->getMessage());
                }
            }
            
            // Verify final balances
            $newCustomerBalance = $this->contractService->callMethod(
                'USDC',
                'balanceOf',
                [$customerAddress]
            );
            
            $newMerchantBalance = $this->contractService->callMethod(
                'USDC',
                'balanceOf',
                [$merchantAddress]
            );
            
            // Return transaction details
            return [
                'status' => 'success',
                'txHash' => $txHash,
                'confirmations' => $confirmation['confirmations'],
                'gasUsed' => $gasUsage['gasUsed'],
                'gasPrice' => $gasUsage['effectiveGasPrice'],
                'gasFee' => $gasUsage['actualFee'],
                'customerBalance' => $newCustomerBalance,
                'merchantBalance' => $newMerchantBalance,
                'timestamp' => time()
            ];
            
        } catch (\Exception $e) {
            throw new \Exception('USDC payment failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Process UST payment
     */
    private function processUstPayment(
        string $customerAddress,
        string $merchantAddress,
        int $amount,
        array $options = []
    ): array {
        try {
            // Execute transfer
            $result = $this->ustHandler->sendTransaction(
                $customerAddress,
                $merchantAddress,
                $amount,
                $options
            );
            
            // Add additional transaction details
            return array_merge($result, [
                'currency' => 'UST',
                'amount' => $amount,
                'customerAddress' => $customerAddress,
                'merchantAddress' => $merchantAddress,
                'timestamp' => time()
            ]);
            
        } catch (\Exception $e) {
            throw new \Exception('UST payment failed: ' . $e->getMessage());
        }
    }

    /**
     * Validate transaction
     */
    public function validateTransaction(
        string $currency,
        string $txHash, 
        int $expectedAmount, 
        string $expectedRecipient
    ): bool {
        try {
            switch ($currency) {
                case 'USDC':
                    return $this->validateUsdcTransaction($txHash, $expectedAmount, $expectedRecipient);
                case 'UST':
                    return $this->validateUstTransaction($txHash, $expectedAmount, $expectedRecipient);
                default:
                    throw new \Exception('Unsupported currency');
            }
            
        } catch (\Exception $e) {
            throw new \Exception('Transaction validation failed: ' . $e->getMessage());
        }
    }

    /**
     * Validate USDC transaction
     */
    private function validateUsdcTransaction(
        string $txHash,
        int $expectedAmount,
        string $expectedRecipient
    ): bool {
        // Get transaction receipt
        $receipt = $this->contractService->waitForConfirmation($txHash);
        
        if ($receipt['receipt']->status !== '0x1') {
            throw new \Exception('Transaction failed');
        }
        
        // Decode transfer event
        $events = $this->contractService->decodeEventLog(
            'USDC',
            'Transfer',
            $receipt['receipt']->logs[0]
        );
        
        // Verify amount and recipient
        if ($events['value'] !== $expectedAmount) {
            throw new \Exception('Invalid transfer amount');
        }
        
        if (strtolower($events['to']) !== strtolower($expectedRecipient)) {
            throw new \Exception('Invalid recipient');
        }
        
        return true;
    }

    /**
     * Validate UST transaction
     */
    private function validateUstTransaction(
        string $txHash,
        int $expectedAmount,
        string $expectedRecipient
    ): bool {
        // Get transaction details
        $details = $this->ustHandler->getTransactionDetails($txHash);
        
        // Verify transaction status
        if ($details['status'] !== 'success') {
            throw new \Exception('Transaction failed');
        }
        
        // Get transaction info
        $txInfo = $this->ustHandler->getTransactionDetails($txHash);
        
        // Verify amount and recipient
        $msgSend = $txInfo['tx']['value']['msg'][0]['value'];
        
        if ((int) $msgSend['amount'][0]['amount'] !== $expectedAmount) {
            throw new \Exception('Invalid transfer amount');
        }
        
        if ($msgSend['to_address'] !== $expectedRecipient) {
            throw new \Exception('Invalid recipient');
        }
        
        return true;
    }
    
    /**
     * Get supported stablecoins
     */
    public function getSupportedCoins(): array {
        return array_keys(self::SUPPORTED_COINS);
    }
    
    /**
     * Get coin details
     */
    public function getCoinDetails(string $coin): ?array {
        return self::SUPPORTED_COINS[$coin] ?? null;
    }
    
    /**
     * Format amount according to coin decimals
     */
    public function formatAmount(string $coin, float $amount): int {
        if (!isset(self::SUPPORTED_COINS[$coin])) {
            throw new \Exception('Unsupported coin');
        }
        
        $decimals = self::SUPPORTED_COINS[$coin]['decimals'];
        return (int) ($amount * (10 ** $decimals));
    }
    
    /**
     * Convert amount to display format
     */
    public function formatDisplay(string $coin, int $amount): float {
        if (!isset(self::SUPPORTED_COINS[$coin])) {
            throw new \Exception('Unsupported coin');
        }
        
        $decimals = self::SUPPORTED_COINS[$coin]['decimals'];
        return $amount / (10 ** $decimals);
    }
}
