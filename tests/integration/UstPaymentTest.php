<?php

namespace NimiPay\Tests\Integration;

use PHPUnit\Framework\TestCase;
use NimiPay\Services\UstTransactionHandler;
use NimiPay\Services\StablecoinProcessor;
use NimiPay\Services\GasAbstractionService;
use NimiPay\Services\ContractInteractionService;
use NimiPay\Services\PriceService;

class UstPaymentTest extends TestCase {
    private $ustHandler;
    private $stablecoinProcessor;
    private $gasService;
    private $contractService;
    private $priceService;
    
    // Test accounts
    private const TEST_ACCOUNTS = [
        'merchant' => 'terra1merchant9address8here7please6use5valid4one3ok2thx1',
        'customer' => 'terra1customer9address8here7please6use5valid4one3ok2thx1'
    ];
    
    // Test amounts
    private const TEST_AMOUNTS = [
        'small' => 1000000,    // 1 UST
        'medium' => 10000000,  // 10 UST
        'large' => 100000000   // 100 UST
    ];
    
    protected function setUp(): void {
        // Initialize services with test network
        $this->ustHandler = new UstTransactionHandler('testnet');
        $this->gasService = new GasAbstractionService('testnet');
        $this->contractService = new ContractInteractionService('testnet');
        $this->priceService = new PriceService();
        
        $this->stablecoinProcessor = new StablecoinProcessor(
            new UsdcTransactionHandler($this->gasService, 'testnet'),
            $this->ustHandler,
            $this->gasService,
            $this->contractService,
            $this->priceService,
            'testnet'
        );
    }
    
    /**
     * Test complete payment flow
     */
    public function testCompletePaymentFlow(): void {
        // 1. Create payment request
        $amount = self::TEST_AMOUNTS['small'];
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        // 2. Process payment
        $result = $this->stablecoinProcessor->processStablecoinPayment(
            'UST',
            $customerAddress,
            $merchantAddress,
            $amount,
            [
                'privateKey' => 'test_private_key'
            ]
        );
        
        // 3. Verify result structure
        $this->assertIsArray($result);
        $this->assertArrayHasKey('status', $result);
        $this->assertArrayHasKey('txHash', $result);
        $this->assertArrayHasKey('confirmations', $result);
        $this->assertArrayHasKey('fee', $result);
        
        // 4. Verify transaction success
        $this->assertEquals('success', $result['status']);
        
        // 5. Verify confirmations
        $this->assertGreaterThanOrEqual(
            5,
            $result['confirmations'],
            'Should have minimum required confirmations'
        );
        
        // 6. Validate transaction
        $isValid = $this->stablecoinProcessor->validateTransaction(
            'UST',
            $result['txHash'],
            $amount,
            $merchantAddress
        );
        
        $this->assertTrue($isValid, 'Transaction should be valid');
    }
    
    /**
     * Test payment with different amounts
     * @dataProvider paymentAmountProvider
     */
    public function testPaymentWithDifferentAmounts(int $amount): void {
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        $result = $this->stablecoinProcessor->processStablecoinPayment(
            'UST',
            $customerAddress,
            $merchantAddress,
            $amount,
            [
                'privateKey' => 'test_private_key'
            ]
        );
        
        $this->assertEquals('success', $result['status']);
        
        // Verify transaction
        $isValid = $this->stablecoinProcessor->validateTransaction(
            'UST',
            $result['txHash'],
            $amount,
            $merchantAddress
        );
        
        $this->assertTrue($isValid);
    }
    
    /**
     * Test error handling for insufficient balance
     */
    public function testInsufficientBalanceHandling(): void {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Insufficient balance');
        
        $amount = PHP_INT_MAX; // Amount larger than possible balance
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        $this->stablecoinProcessor->processStablecoinPayment(
            'UST',
            $customerAddress,
            $merchantAddress,
            $amount
        );
    }
    
    /**
     * Test invalid address handling
     */
    public function testInvalidAddressHandling(): void {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Invalid Terra address');
        
        $amount = self::TEST_AMOUNTS['small'];
        $merchantAddress = 'invalid_address';
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        $this->stablecoinProcessor->processStablecoinPayment(
            'UST',
            $customerAddress,
            $merchantAddress,
            $amount
        );
    }
    
    /**
     * Test amount formatting
     */
    public function testAmountFormatting(): void {
        // Test formatting to internal representation
        $amount = $this->stablecoinProcessor->formatAmount('UST', 1.5);
        $this->assertEquals(1500000, $amount);
        
        // Test formatting to display
        $display = $this->stablecoinProcessor->formatDisplay('UST', 1500000);
        $this->assertEquals(1.5, $display);
    }
    
    /**
     * Test currency validation
     */
    public function testCurrencyValidation(): void {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Unsupported currency');
        
        $amount = self::TEST_AMOUNTS['small'];
        $merchantAddress = self::TEST_ACCOUNTS['merchant'];
        $customerAddress = self::TEST_ACCOUNTS['customer'];
        
        $this->stablecoinProcessor->processStablecoinPayment(
            'INVALID',
            $customerAddress,
            $merchantAddress,
            $amount
        );
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
        unset($this->ustHandler);
        unset($this->stablecoinProcessor);
        unset($this->gasService);
        unset($this->contractService);
        unset($this->priceService);
    }
}
