<?php

namespace NimiPay\Services;

use Terra\LCD\LCDClient;
use Terra\LCD\Api\TxAPI;
use Terra\Core\Coin;
use Terra\Core\Fee;
use Terra\Core\SignDoc;

class UstTransactionHandler {
    private $lcd;
    private $txApi;
    private $network;
    
    // Network configurations
    private const NETWORKS = [
        'mainnet' => [
            'url' => 'https://lcd.terra.dev',
            'chainID' => 'columbus-5',
            'denom' => 'uusd',
            'confirmations' => 15
        ],
        'testnet' => [
            'url' => 'https://bombay-lcd.terra.dev',
            'chainID' => 'bombay-12',
            'denom' => 'uusd',
            'confirmations' => 5
        ]
    ];
    
    // Transaction limits
    private const LIMITS = [
        'min_amount' => 1000000,  // 1 UST (6 decimals)
        'max_amount' => 1000000000000,  // 1M UST
        'min_fee' => 200000,  // 0.2 UST
        'max_fee' => 5000000  // 5 UST
    ];
    
    public function __construct(string $network = 'mainnet') {
        $this->network = $network;
        
        // Initialize Terra LCD client
        $this->lcd = new LCDClient(
            self::NETWORKS[$network]['url'],
            self::NETWORKS[$network]['chainID']
        );
        
        $this->txApi = new TxAPI($this->lcd);
    }
    
    /**
     * Send UST transaction
     */
    public function sendTransaction(
        string $from,
        string $to,
        int $amount,
        array $options = []
    ): array {
        try {
            // Validate inputs
            $this->validateTransaction($from, $to, $amount);
            
            // Create coin object
            $coin = new Coin(
                self::NETWORKS[$this->network]['denom'],
                $amount
            );
            
            // Estimate fee
            $fee = $this->estimateFee($from, $to, $amount);
            
            // Prepare transaction
            $tx = $this->prepareTx($from, $to, $coin, $fee);
            
            // Sign transaction
            $signedTx = $this->signTx($tx, $options['privateKey']);
            
            // Broadcast transaction
            $result = $this->txApi->broadcast($signedTx);
            
            if (!isset($result['txhash'])) {
                throw new \Exception('Transaction failed: No hash returned');
            }
            
            // Wait for confirmations
            $confirmation = $this->waitForConfirmation(
                $result['txhash'],
                self::NETWORKS[$this->network]['confirmations']
            );
            
            return [
                'txHash' => $result['txhash'],
                'confirmations' => $confirmation['confirmations'],
                'fee' => $fee->amount->toArray()[0]['amount'],
                'status' => $confirmation['status']
            ];
            
        } catch (\Exception $e) {
            throw new \Exception('UST transaction failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Validate transaction parameters
     */
    private function validateTransaction(
        string $from,
        string $to,
        int $amount
    ): void {
        // Validate addresses
        if (!$this->isValidAddress($from) || !$this->isValidAddress($to)) {
            throw new \Exception('Invalid Terra address');
        }
        
        // Validate amount
        if ($amount < self::LIMITS['min_amount']) {
            throw new \Exception('Amount below minimum');
        }
        
        if ($amount > self::LIMITS['max_amount']) {
            throw new \Exception('Amount above maximum');
        }
        
        // Check balance
        $balance = $this->getBalance($from);
        if ($balance < $amount) {
            throw new \Exception('Insufficient balance');
        }
    }
    
    /**
     * Validate Terra address
     */
    private function isValidAddress(string $address): bool {
        return preg_match('/^terra1[a-z0-9]{38}$/', $address) === 1;
    }
    
    /**
     * Get account balance
     */
    private function getBalance(string $address): int {
        $balances = $this->lcd->bank->balances($address);
        
        foreach ($balances as $coin) {
            if ($coin->denom === self::NETWORKS[$this->network]['denom']) {
                return (int) $coin->amount;
            }
        }
        
        return 0;
    }
    
    /**
     * Estimate transaction fee
     */
    private function estimateFee(
        string $from,
        string $to,
        int $amount
    ): Fee {
        // Get gas price
        $gasPrice = $this->lcd->oracle->actives();
        $ustPrice = $gasPrice[self::NETWORKS[$this->network]['denom']];
        
        // Calculate gas
        $gasLimit = 100000; // Standard transfer
        $feeAmount = (int) ($gasLimit * $ustPrice);
        
        // Apply limits
        if ($feeAmount < self::LIMITS['min_fee']) {
            $feeAmount = self::LIMITS['min_fee'];
        }
        
        if ($feeAmount > self::LIMITS['max_fee']) {
            $feeAmount = self::LIMITS['max_fee'];
        }
        
        return new Fee($gasLimit, [
            new Coin(self::NETWORKS[$this->network]['denom'], $feeAmount)
        ]);
    }
    
    /**
     * Prepare transaction
     */
    private function prepareTx(
        string $from,
        string $to,
        Coin $coin,
        Fee $fee
    ): SignDoc {
        // Get account details
        $account = $this->lcd->auth->accountInfo($from);
        
        // Create transaction
        return new SignDoc(
            self::NETWORKS[$this->network]['chainID'],
            $account->getAccountNumber(),
            $account->getSequence(),
            $fee,
            [
                [
                    'type' => 'bank/MsgSend',
                    'value' => [
                        'from_address' => $from,
                        'to_address' => $to,
                        'amount' => [$coin->toArray()]
                    ]
                ]
            ],
            ''  // memo
        );
    }
    
    /**
     * Sign transaction
     */
    private function signTx(SignDoc $tx, string $privateKey): string {
        // Sign transaction
        $signature = $tx->sign($privateKey);
        
        // Return signed transaction
        return $tx->toSigned($signature);
    }
    
    /**
     * Wait for transaction confirmations
     */
    private function waitForConfirmation(
        string $txHash,
        int $requiredConfirmations
    ): array {
        $start = time();
        $timeout = 60; // 1 minute timeout
        
        while (true) {
            // Check timeout
            if (time() - $start > $timeout) {
                throw new \Exception('Confirmation timeout');
            }
            
            // Get transaction info
            $txInfo = $this->txApi->txInfo($txHash);
            
            if (!$txInfo) {
                sleep(1);
                continue;
            }
            
            // Get current block
            $currentBlock = $this->lcd->tendermint->blockInfo()['block']['header']['height'];
            
            // Calculate confirmations
            $confirmations = $currentBlock - $txInfo['height'];
            
            if ($confirmations >= $requiredConfirmations) {
                return [
                    'confirmations' => $confirmations,
                    'status' => $txInfo['code'] === 0 ? 'success' : 'failed'
                ];
            }
            
            sleep(1);
        }
    }
    
    /**
     * Get transaction details
     */
    public function getTransactionDetails(string $txHash): array {
        $txInfo = $this->txApi->txInfo($txHash);
        
        if (!$txInfo) {
            throw new \Exception('Transaction not found');
        }
        
        return [
            'hash' => $txHash,
            'height' => $txInfo['height'],
            'status' => $txInfo['code'] === 0 ? 'success' : 'failed',
            'fee' => $txInfo['tx']['value']['fee']['amount'][0]['amount'],
            'memo' => $txInfo['tx']['value']['memo'],
            'timestamp' => $txInfo['timestamp']
        ];
    }
}
