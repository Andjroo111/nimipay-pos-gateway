<?php

namespace Nimipay\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Nimipay\Services\PaymentProcessor;
use Nimipay\Services\PriceService;

class CryptoPaymentTest extends TestCase
{
    private $paymentProcessor;
    private $priceService;

    protected function setUp(): void
    {
        $this->paymentProcessor = new PaymentProcessor();
        $this->priceService = new PriceService();
    }

    public function testNimiqPaymentValidation()
    {
        // Test NIM payment validation
        $result = $this->paymentProcessor->validateTransaction(
            'NIM',
            'dummy_tx_hash',
            'NQ12 3456 7890 ABCD',
            1.0000 // 1 NIM
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));
        
        if ($result['status'] === 'pending') {
            $this->assertArrayHasKey('confirmations', $result);
            $this->assertArrayHasKey('required_confirmations', $result);
            $this->assertEquals(2, $result['required_confirmations']); // NIM requires 2 confirmations
        }
    }

    public function testBitcoinPaymentValidation()
    {
        // Test BTC payment validation
        $result = $this->paymentProcessor->validateTransaction(
            'BTC',
            'dummy_btc_tx_hash',
            'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
            0.00123456 // Test BTC amount
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));
        
        if ($result['status'] === 'pending') {
            $this->assertArrayHasKey('confirmations', $result);
            $this->assertArrayHasKey('required_confirmations', $result);
            $this->assertEquals(3, $result['required_confirmations']); // BTC requires 3 confirmations
        }
    }

    public function testPriceConversion()
    {
        // Test USD to NIM conversion
        $nimAmount = $this->priceService->convertAmount(10.00, 'NIM', true);
        $this->assertIsFloat($nimAmount);
        $this->assertGreaterThan(0, $nimAmount);

        // Test USD to BTC conversion
        $btcAmount = $this->priceService->convertAmount(10.00, 'BTC', true);
        $this->assertIsFloat($btcAmount);
        $this->assertGreaterThan(0, $btcAmount);
    }

    public function testInvalidCurrency()
    {
        $this->expectException(\Exception::class);
        $this->paymentProcessor->validateTransaction(
            'INVALID',
            'dummy_tx_hash',
            'invalid_address',
            1.0
        );
    }

    public function testInvalidAddress()
    {
        // Test invalid NIM address
        $this->expectException(\Exception::class);
        $this->paymentProcessor->validateTransaction(
            'NIM',
            'dummy_tx_hash',
            'invalid_nim_address',
            1.0
        );

        // Test invalid BTC address
        $this->expectException(\Exception::class);
        $this->paymentProcessor->validateTransaction(
            'BTC',
            'dummy_tx_hash',
            'invalid_btc_address',
            1.0
        );
    }

    public function testExchangeRateFreshness()
    {
        // Test NIM rate freshness
        $nimRate = $this->priceService->getCurrentPrice('NIM');
        $this->assertTrue($this->priceService->isRateFresh('NIM'));

        // Test BTC rate freshness
        $btcRate = $this->priceService->getCurrentPrice('BTC');
        $this->assertTrue($this->priceService->isRateFresh('BTC'));
    }

    public function testAmountFormatting()
    {
        // Test NIM amount formatting (4 decimals)
        $formattedNim = $this->priceService->formatAmount(1.23456789, 'NIM');
        $this->assertEquals('1.2346', $formattedNim);

        // Test BTC amount formatting (8 decimals)
        $formattedBtc = $this->priceService->formatAmount(1.23456789, 'BTC');
        $this->assertEquals('1.23456789', $formattedBtc);
    }
}
