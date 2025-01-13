<?php

namespace NimiPay\Tests\Integration;

use PHPUnit\Framework\TestCase;
use NimiPay\Services\UsdcTransactionHandler;
use NimiPay\Services\GasAbstractionService;
use NimiPay\Services\ContractInteractionService;
use NimiPay\Services\PaymentProcessor;

class UsdcPaymentTest extends TestCase {
    private $usdcHandler;
    private $gasService;
    private $contractService;
    private $paymentProcessor;
    
    // Test accounts
    private const TEST_ACCOUNTS = [
        'merchant' => '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        'customer' => '0x1234567890123456789012345678901234567890',
        'relayer' => '0x9876543210987654321098765432109876543210'
    ];
    
    // Test amounts
    private const TEST_AMOUNTS = [
        'small' => 1000000,    // 1 USDC
        'medium' => 10000000,  // 10 USDC
        'large' => 100000000   // 100 USDC
    ];
    
    protected function setUp(): void {
        // Initialize services with test network
        $this->gasService = new GasAbstractionService('testnet');
        $this->contractService = new ContractInteractionService('testnet');
        $this->usdcHandler = new UsdcTransactionHandler($this->gasService, 'testnet');
        $this->paymentProcessor = new PaymentProcessor();
        
        // Initialize contract instances
        $this->contractService->initializeContract(
            'USDC',
            UsdcTransactionHandler::TOKEN_ABI,
            UsdcTransactionHandler::CONTRACT_ADDRESSES['testnet']['token']
        );
    }
    
    /**
     * Test complete payment flow with gas abstraction
     */
    public function testCompletePaymentFlow(): void {
        // 1. Create payment request
        $amount = self::TEST_AMOUNTS['small'];
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        // 2. Verify customer balance
        $balance = $this->contractService->callMethod(
            'USDC',
            'balanceOf',
            [$customerAddress]
        );
        
        $this->assertGreaterThanOrEqual(
            $amount,
            $balance,
            'Customer should have sufficient balance'
        );
        
        // 3. Get gas estimate
        $gasEstimate = $this->gasService->estimateGas('transferWithPermit');
        $this->assertIsArray($gasEstimate);
        
        // 4. Generate permit
        $permit = $this->usdcHandler->getPermit(
            $customerAddress,
            $merchantAddress,
            $amount
        );
        
        $this->assertIsArray($permit);
        $this->assertArrayHasKey('deadline', $permit);
        
        // 5. Execute transfer
        $txHash = $this->usdcHandler->transferWithPermit(
            $customerAddress,
            $merchantAddress,
            $amount,
            $permit,
            $gasEstimate
        );
        
        $this->assertIsString($txHash);
        
        // 6. Wait for confirmations
        $confirmation = $this->contractService->waitForConfirmation($txHash);
        $this->assertIsArray($confirmation);
        $this->assertArrayHasKey('receipt', $confirmation);
        
        // 7. Verify transfer success
        $receipt = $confirmation['receipt'];
        $this->assertEquals('0x1', $receipt->status);
        
        // 8. Monitor gas usage
        $gasUsage = $this->gasService->monitorGasUsage($txHash);
        $this->assertIsArray($gasUsage);
        
        // 9. Handle gas reimbursement
        $relayerAddress = self::TEST_ACCOUNTS['relayer'];
        try {
            $this->gasService->handleGasReimbursement($txHash, $relayerAddress);
        } catch (\Exception $e) {
            $this->assertEquals('Reimbursement not implemented', $e->getMessage());
        }
        
        // 10. Verify final balances
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
        
        // Verify customer balance decreased
        $this->assertEquals(
            $balance - $amount,
            $newCustomerBalance,
            'Customer balance should decrease by payment amount'
        );
        
        // Verify merchant balance increased
        $this->assertGreaterThan(
            0,
            $newMerchantBalance,
            'Merchant should receive payment'
        );
    }
    
    /**
     * Test gas abstraction with different payment amounts
     * @dataProvider paymentAmountProvider
     */
    public function testGasAbstractionWithDifferentAmounts(int $amount): void {
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        // Get initial gas estimate
        $gasEstimate = $this->gasService->estimateGas('transferWithPermit');
        
        // Execute transfer
        $permit = $this->usdcHandler->getPermit(
            $customerAddress,
            $merchantAddress,
            $amount
        );
        
        $txHash = $this->usdcHandler->transferWithPermit(
            $customerAddress,
            $merchantAddress,
            $amount,
            $permit,
            $gasEstimate
        );
        
        // Verify gas usage
        $gasUsage = $this->gasService->monitorGasUsage($txHash);
        
        // Gas usage should be within reasonable limits
        $this->assertLessThan(
            100000,
            $gasUsage['gasUsed'],
            'Gas usage should be reasonable'
        );
        
        // Gas price should not exceed maximum
        $this->assertLessThanOrEqual(
            GasAbstractionService::MAX_GAS_PRICE,
            $gasUsage['effectiveGasPrice'],
            'Gas price should not exceed maximum'
        );
    }
    
    /**
     * Test error handling for insufficient balance
     */
    public function testInsufficientBalanceHandling(): void {
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        // Try to transfer more than balance
        $balance = $this->contractService->callMethod(
            'USDC',
            'balanceOf',
            [$customerAddress]
        );
        
        $amount = $balance + 1000000; // More than available
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Insufficient balance');
        
        $permit = $this->usdcHandler->getPermit(
            $customerAddress,
            $merchantAddress,
            $amount
        );
        
        $gasEstimate = $this->gasService->estimateGas('transferWithPermit');
        
        $this->usdcHandler->transferWithPermit(
            $customerAddress,
            $merchantAddress,
            $amount,
            $permit,
            $gasEstimate
        );
    }
    
    /**
     * Test high gas price handling
     */
    public function testHighGasPriceHandling(): void {
        // Mock extremely high gas price
        $mockGasPrice = bcmul(GasAbstractionService::MAX_GAS_PRICE, '2', 0);
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Gas price exceeds maximum allowed');
        
        // This should throw an exception
        $this->gasService->estimateGas('transfer');
    }
    
    /**
     * Data provider for payment amounts
     */
    public function paymentAmountProvider(): array {
        return [
            'small payment' => [self::TEST_AMOUNTS['small']],
            'medium payment' => [self::TEST_AMOUNTS['medium']],
            'large payment' => [self::TEST_AMOUNTS['large']]
        ];
    }
    
    protected function tearDown(): void {
        // Clean up
        unset($this->usdcHandler);
        unset($this->gasService);
        unset($this->contractService);
        unset($this->paymentProcessor);
    }
}
