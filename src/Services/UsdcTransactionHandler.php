<?php

namespace NimiPay\Services;

use Web3\Web3;
use Web3\Contract;
use Web3\Providers\HttpProvider;
use Web3\RequestManagers\HttpRequestManager;

class UsdcTransactionHandler {
    private $web3;
    private $tokenContract;
    private $transferContract;
    private $gasService;
    
    // Contract ABIs
    private const TOKEN_ABI = [
        'function balanceOf(address account) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function nonces(address owner) view returns (uint256)',
        'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    private const TRANSFER_ABI = [
        'function transfer(address token, uint256 amount, address target, uint256 fee)',
        'function transferWithPermit(address token, uint256 amount, address target, uint256 fee, uint256 value, bytes32 sigR, bytes32 sigS, uint8 sigV)',
        'function getGasAndDataLimits() view returns (tuple(uint256 acceptanceBudget, uint256 preRelayedCallGasLimit, uint256 postRelayedCallGasLimit, uint256 calldataSizeLimit) limits)',
        'function getNonce(address from) view returns (uint256)',
        'function getRequiredRelayGas(bytes4 methodId) view returns (uint256 gas)'
    ];
    
    // Contract addresses
    private const CONTRACT_ADDRESSES = [
        'mainnet' => [
            'token' => '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            'transfer' => '[TRANSFER_CONTRACT_ADDRESS]'
        ],
        'testnet' => [
            'token' => '[TESTNET_TOKEN_ADDRESS]',
            'transfer' => '[TESTNET_TRANSFER_ADDRESS]'
        ]
    ];

    public function __construct(GasAbstractionService $gasService, string $network = 'mainnet') {
        // Initialize Web3
        $provider = new HttpProvider(new HttpRequestManager(
            $network === 'mainnet' 
                ? 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID'
                : 'https://goerli.infura.io/v3/YOUR-PROJECT-ID'
        ));
        $this->web3 = new Web3($provider);
        
        // Initialize contracts
        $this->tokenContract = new Contract(
            $provider,
            self::TOKEN_ABI,
            self::CONTRACT_ADDRESSES[$network]['token']
        );
        
        $this->transferContract = new Contract(
            $provider,
            self::TRANSFER_ABI,
            self::CONTRACT_ADDRESSES[$network]['transfer']
        );
        
        $this->gasService = $gasService;
    }
    
    /**
     * Get permit signature for USDC transfer
     */
    public function getPermit(string $from, string $spender, int $amount): array {
        $nonce = $this->getNonce($from);
        $deadline = time() + 3600; // 1 hour from now
        
        // EIP-2612 permit type data
        $domainData = [
            'name' => 'USD Coin',
            'version' => '2',
            'chainId' => $this->getChainId(),
            'verifyingContract' => self::CONTRACT_ADDRESSES[$this->network]['token']
        ];
        
        $permitData = [
            'owner' => $from,
            'spender' => $spender,
            'value' => $amount,
            'nonce' => $nonce,
            'deadline' => $deadline
        ];
        
        // Get signature from wallet
        $signature = $this->signPermit($domainData, $permitData);
        
        return [
            'v' => $signature['v'],
            'r' => $signature['r'],
            's' => $signature['s'],
            'deadline' => $deadline
        ];
    }
    
    /**
     * Execute USDC transfer with gas abstraction
     */
    public function transferWithPermit(
        string $from,
        string $to,
        int $amount,
        array $permit,
        array $gasData
    ): string {
        try {
            // Validate inputs
            $this->validateTransfer($from, $to, $amount);
            
            // Get gas estimate
            $gasEstimate = $this->gasService->estimateGas($amount);
            
            // Execute transfer
            $result = $this->transferContract->methods->transferWithPermit(
                self::CONTRACT_ADDRESSES[$this->network]['token'],
                $amount,
                $to,
                $gasEstimate['fee'],
                $permit['deadline'],
                $permit['r'],
                $permit['s'],
                $permit['v']
            )->send([
                'from' => $from,
                'gas' => $gasEstimate['limit'],
                'gasPrice' => $gasEstimate['price']
            ]);
            
            // Validate result
            if (!$result || !isset($result->transactionHash)) {
                throw new \Exception('Transfer failed: No transaction hash returned');
            }
            
            return $result->transactionHash;
            
        } catch (\Exception $e) {
            throw new \Exception('USDC transfer failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Validate transfer parameters
     */
    private function validateTransfer(string $from, string $to, int $amount): void {
        // Check addresses
        if (!$this->isValidAddress($from) || !$this->isValidAddress($to)) {
            throw new \Exception('Invalid address format');
        }
        
        // Check amount
        if ($amount <= 0) {
            throw new \Exception('Invalid amount');
        }
        
        // Check balance
        $balance = $this->getBalance($from);
        if ($balance < $amount) {
            throw new \Exception('Insufficient balance');
        }
    }
    
    /**
     * Get USDC balance for address
     */
    private function getBalance(string $address): int {
        return $this->tokenContract->methods->balanceOf($address)->call();
    }
    
    /**
     * Get next nonce for address
     */
    private function getNonce(string $address): int {
        return $this->tokenContract->methods->nonces($address)->call();
    }
    
    /**
     * Validate Ethereum address format
     */
    private function isValidAddress(string $address): bool {
        return preg_match('/^0x[a-fA-F0-9]{40}$/', $address) === 1;
    }
    
    /**
     * Get current chain ID
     */
    private function getChainId(): int {
        return $this->network === 'mainnet' ? 1 : 5; // 1 for mainnet, 5 for goerli
    }
    
    /**
     * Sign permit data
     * This is a placeholder - actual implementation would integrate with user's wallet
     */
    private function signPermit(array $domainData, array $permitData): array {
        // TODO: Implement actual signing logic
        // This would typically integrate with MetaMask or other wallet
        throw new \Exception('Permit signing not implemented');
    }
}
