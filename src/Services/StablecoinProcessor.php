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
        ]
    ];
    
    public function __construct(
        UsdcTransactionHandler $usdcHandler,
        GasAbstractionService $gasService,
        ContractInteractionService $contractService,
        PriceService $priceService,
        string $network = 'mainnet'
    ) {
        $this->usdcHandler = $usdcHandler;
        $this->gasService = $gasService;
        $this->contractService = $contractService;
        $this->priceService = $priceService;
        $this->network = $network;
    }
    
    /**
     * Process USDC payment
     */
    public function processUsdcPayment(
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
     * Validate USDC transaction
     */
    public function validateUsdcTransaction(
        string $txHash,
        int $expectedAmount,
        string $expectedRecipient
    ): bool {
        try {
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
            
        } catch (\Exception $e) {
            throw new \Exception('Transaction validation failed: ' . $e->getMessage());
        }
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
