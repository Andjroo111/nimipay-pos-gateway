<?php

namespace NimiPay\Services;

use Web3\Web3;
use Web3\Contract;
use Web3\Providers\HttpProvider;
use Web3\RequestManagers\HttpRequestManager;
use Web3\Utils;

class ContractInteractionService {
    private $web3;
    private $network;
    private $contracts = [];
    private $eventListeners = [];
    
    // Default block confirmation requirements
    private const CONFIRMATION_BLOCKS = [
        'mainnet' => 12, // 12 blocks for mainnet
        'testnet' => 5   // 5 blocks for testnet
    ];
    
    public function __construct(string $network = 'mainnet') {
        $this->network = $network;
        
        // Initialize Web3
        $provider = new HttpProvider(new HttpRequestManager(
            $network === 'mainnet' 
                ? 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID'
                : 'https://goerli.infura.io/v3/YOUR-PROJECT-ID'
        ));
        $this->web3 = new Web3($provider);
    }
    
    /**
     * Initialize contract instance
     */
    public function initializeContract(string $name, array $abi, string $address): void {
        try {
            $this->contracts[$name] = new Contract(
                $this->web3->provider,
                json_encode($abi),
                $address
            );
        } catch (\Exception $e) {
            throw new \Exception("Failed to initialize contract $name: " . $e->getMessage());
        }
    }
    
    /**
     * Call contract read method
     */
    public function callMethod(
        string $contractName,
        string $method,
        array $params = []
    ) {
        try {
            if (!isset($this->contracts[$contractName])) {
                throw new \Exception("Contract $contractName not initialized");
            }
            
            $contract = $this->contracts[$contractName];
            return $contract->call($method, $params);
            
        } catch (\Exception $e) {
            throw new \Exception("Contract call failed: " . $e->getMessage());
        }
    }
    
    /**
     * Send contract transaction
     */
    public function sendTransaction(
        string $contractName,
        string $method,
        array $params = [],
        array $options = []
    ): string {
        try {
            if (!isset($this->contracts[$contractName])) {
                throw new \Exception("Contract $contractName not initialized");
            }
            
            $contract = $this->contracts[$contractName];
            
            // Prepare transaction
            $tx = $contract->methods->$method(...$params);
            
            // Send transaction
            $result = $tx->send($options);
            
            if (!$result || !isset($result->transactionHash)) {
                throw new \Exception('Transaction failed: No hash returned');
            }
            
            return $result->transactionHash;
            
        } catch (\Exception $e) {
            throw new \Exception("Transaction failed: " . $e->getMessage());
        }
    }
    
    /**
     * Subscribe to contract events
     */
    public function subscribeToEvent(
        string $contractName,
        string $eventName,
        callable $callback
    ): void {
        try {
            if (!isset($this->contracts[$contractName])) {
                throw new \Exception("Contract $contractName not initialized");
            }
            
            $contract = $this->contracts[$contractName];
            
            // Create subscription
            $subscription = $contract->events->$eventName([
                'fromBlock' => 'latest'
            ], function($error, $event) use ($callback) {
                if ($error) {
                    throw new \Exception("Event error: " . $error->getMessage());
                }
                
                $callback($event);
            });
            
            // Store subscription
            $this->eventListeners[$contractName][$eventName] = $subscription;
            
        } catch (\Exception $e) {
            throw new \Exception("Failed to subscribe to event: " . $e->getMessage());
        }
    }
    
    /**
     * Wait for transaction confirmations
     */
    public function waitForConfirmation(string $txHash, int $confirmations = null): array {
        try {
            if ($confirmations === null) {
                $confirmations = self::CONFIRMATION_BLOCKS[$this->network];
            }
            
            $receipt = null;
            $confirmed = false;
            $startBlock = $this->web3->eth->blockNumber();
            
            while (!$confirmed) {
                // Get receipt
                $receipt = $this->web3->eth->getTransactionReceipt($txHash);
                
                if (!$receipt) {
                    sleep(1);
                    continue;
                }
                
                // Get current block
                $currentBlock = $this->web3->eth->blockNumber();
                
                // Check confirmations
                $blocksPassed = $currentBlock - $receipt->blockNumber;
                if ($blocksPassed >= $confirmations) {
                    $confirmed = true;
                } else {
                    sleep(1);
                }
            }
            
            return [
                'receipt' => $receipt,
                'confirmations' => $confirmations,
                'blocksPassed' => $blocksPassed
            ];
            
        } catch (\Exception $e) {
            throw new \Exception("Confirmation check failed: " . $e->getMessage());
        }
    }
    
    /**
     * Decode contract event logs
     */
    public function decodeEventLog(
        string $contractName,
        string $eventName,
        object $log
    ): array {
        try {
            if (!isset($this->contracts[$contractName])) {
                throw new \Exception("Contract $contractName not initialized");
            }
            
            $contract = $this->contracts[$contractName];
            
            // Decode log
            $decoded = $contract->events->$eventName->decode($log);
            
            if (!$decoded) {
                throw new \Exception("Failed to decode event log");
            }
            
            return $decoded;
            
        } catch (\Exception $e) {
            throw new \Exception("Log decoding failed: " . $e->getMessage());
        }
    }
    
    /**
     * Validate contract address
     */
    public function validateAddress(string $address): bool {
        return Utils::isAddress($address);
    }
    
    /**
     * Get contract instance
     */
    public function getContract(string $name): ?Contract {
        return $this->contracts[$name] ?? null;
    }
    
    /**
     * Clean up event subscriptions
     */
    public function __destruct() {
        foreach ($this->eventListeners as $contractListeners) {
            foreach ($contractListeners as $subscription) {
                $subscription->unsubscribe();
            }
        }
    }
}
