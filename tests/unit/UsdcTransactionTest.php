<?php

namespace NimiPay\Tests\Unit;

use PHPUnit\Framework\TestCase;
use NimiPay\Services\UsdcTransactionHandler;
use NimiPay\Services\GasAbstractionService;
use NimiPay\Services\ContractInteractionService;

class UsdcTransactionTest extends TestCase {
    private $usdcHandler;
    private $gasService;
    private $contractService;
    
    protected function setUp(): void {
        // Initialize services with test network
        $this->gasService = new GasAbstractionService('testnet');
        $this->contractService = new ContractInteractionService('testnet');
        $this->usdcHandler = new UsdcTransactionHandler($this->gasService, 'testnet');
    }
    
    public function testGasEstimation(): void {
        // Test gas estimation
        $estimate = $this->gasService->estimateGas('transfer');
        
        $this->assertIsArray($estimate);
        $this->assertArrayHasKey('price', $estimate);
        $this->assertArrayHasKey('limit', $estimate);
        $this->assertArrayHasKey('fee', $estimate);
        
        // Verify gas limits are within expected range
        $this->assertGreaterThan(0, $estimate['limit']);
        $this->assertLessThan(100000, $estimate['limit']); // Standard ERC20 transfer should be well under 100k
    }
    
    public function testPermitGeneration(): void {
        $testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        $spenderAddress = '0x1234567890123456789012345678901234567890';
        $amount = 1000000; // 1 USDC (6 decimals)
        
        $permit = $this->usdcHandler->getPermit($testAddress, $spenderAddress, $amount);
        
        $this->assertIsArray($permit);
        $this->assertArrayHasKey('v', $permit);
        $this->assertArrayHasKey('r', $permit);
        $this->assertArrayHasKey('s', $permit);
        $this->assertArrayHasKey('deadline', $permit);
        
        // Verify deadline is in the future
        $this->assertGreaterThan(time(), $permit['deadline']);
    }
    
    public function testTransferValidation(): void {
        $fromAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        $toAddress = '0x1234567890123456789012345678901234567890';
        $amount = 1000000; // 1 USDC
        
        // Test valid addresses
        $this->assertTrue(
            $this->contractService->validateAddress($fromAddress),
            'From address should be valid'
        );
        $this->assertTrue(
            $this->contractService->validateAddress($toAddress),
            'To address should be valid'
        );
        
        // Test invalid address
        $this->assertFalse(
            $this->contractService->validateAddress('0xinvalid'),
            'Invalid address should fail validation'
        );
    }
    
    public function testTransactionExecution(): void {
        $fromAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        $toAddress = '0x1234567890123456789012345678901234567890';
        $amount = 1000000; // 1 USDC
        
        // Get permit
        $permit = $this->usdcHandler->getPermit($fromAddress, $toAddress, $amount);
        
        // Get gas estimate
        $gasEstimate = $this->gasService->estimateGas('transferWithPermit');
        
        // Execute transfer
        $txHash = $this->usdcHandler->transferWithPermit(
            $fromAddress,
            $toAddress,
            $amount,
            $permit,
            $gasEstimate
        );
        
        $this->assertIsString($txHash);
        $this->assertMatchesRegularExpression('/^0x[a-fA-F0-9]{64}$/', $txHash);
        
        // Wait for confirmation
        $confirmation = $this->contractService->waitForConfirmation($txHash);
        
        $this->assertIsArray($confirmation);
        $this->assertArrayHasKey('receipt', $confirmation);
        $this->assertArrayHasKey('confirmations', $confirmation);
        $this->assertGreaterThanOrEqual(5, $confirmation['confirmations']); // At least 5 blocks on testnet
    }
    
    public function testGasReimbursement(): void {
        $txHash = '0x' . str_repeat('0', 64); // Example transaction hash
        $relayerAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        
        // Monitor gas usage
        $gasUsage = $this->gasService->monitorGasUsage($txHash);
        
        $this->assertIsArray($gasUsage);
        $this->assertArrayHasKey('gasUsed', $gasUsage);
        $this->assertArrayHasKey('effectiveGasPrice', $gasUsage);
        $this->assertArrayHasKey('actualFee', $gasUsage);
        
        // Test reimbursement calculation
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Reimbursement not implemented');
        $this->gasService->handleGasReimbursement($txHash, $relayerAddress);
    }
    
    public function testEventHandling(): void {
        $contractName = 'USDC';
        $eventName = 'Transfer';
        
        // Subscribe to Transfer events
        $this->contractService->subscribeToEvent(
            $contractName,
            $eventName,
            function($event) {
                $this->assertIsObject($event);
                $this->assertObjectHasAttribute('transactionHash', $event);
                $this->assertObjectHasAttribute('returnValues', $event);
                
                $values = $event->returnValues;
                $this->assertArrayHasKey('from', $values);
                $this->assertArrayHasKey('to', $values);
                $this->assertArrayHasKey('value', $values);
            }
        );
    }
    
    protected function tearDown(): void {
        // Clean up any test data or connections
        unset($this->usdcHandler);
        unset($this->gasService);
        unset($this->contractService);
    }
}
