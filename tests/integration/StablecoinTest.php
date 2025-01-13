<?php

namespace Nimipay\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Nimipay\Services\StablecoinProcessor;
use Nimipay\Services\PaymentProcessor;
use Nimipay\Services\PriceService;

class StablecoinTest extends TestCase
{
    private $stablecoinProcessor;
    private $paymentProcessor;
    private $priceService;

    protected function setUp(): void
    {
        $this->stablecoinProcessor = new StablecoinProcessor();
        $this->paymentProcessor = new PaymentProcessor();
        $this->priceService = new PriceService();
    }

    public function testUSDCTransactionValidation()
    {
        // Test USDC payment validation
        $result = $this->stablecoinProcessor->validateUSDCTransaction(
            'dummy_tx_hash',
            10.000000, // 10 USDC
            '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));
        
        if ($result['status'] === 'pending') {
            $this->assertArrayHasKey('confirmations', $result);
            $this->assertArrayHasKey('required_confirmations', $result);
            $this->assertEquals(12, $result['required_confirmations']); // USDC requires 12 confirmations
        }
    }

    public function testUSTTransactionValidation()
    {
        // Test UST payment validation
        $result = $this->stablecoinProcessor->validateUSTTransaction(
            'dummy_tx_hash',
            10.000000, // 10 UST
            'terra1dp0taj85ruc299rkdvzp4z5pfg6z6swaed74e6'
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));
        
        if ($result['status'] === 'pending') {
            $this->assertArrayHasKey('confirmations', $result);
            $this->assertArrayHasKey('required_confirmations', $result);
            $this->assertEquals(15, $result['required_confirmations']); // UST requires 15 confirmations
        }
    }

    public function testUSDCGasFeeEstimation()
    {
        $gasFee = $this->stablecoinProcessor->estimateUSDCGasFee();
        $this->assertIsFloat($gasFee);
        $this->assertGreaterThan(0, $gasFee);
    }

    public function testStablecoinAddressValidation()
    {
        // Test valid USDC (Ethereum) addresses
        $validUSDCAddresses = [
            '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        ];

        foreach ($validUSDCAddresses as $address) {
            $this->assertTrue(
                $this->stablecoinProcessor->validateAddress('USDC', $address),
                "Address should be valid: $address"
            );
        }

        // Test valid UST (Terra) addresses
        $validUSTAddresses = [
            'terra1dp0taj85ruc299rkdvzp4z5pfg6z6swaed74e6',
            'terra1jlgaqy9nvn2hf5t2sra9ycz8s77wnf9l0kmgcp'
        ];

        foreach ($validUSTAddresses as $address) {
            $this->assertTrue(
                $this->stablecoinProcessor->validateAddress('UST', $address),
                "Address should be valid: $address"
            );
        }

        // Test invalid addresses
        $invalidAddresses = [
            'invalid_address',
            '0xinvalid',
            'terra1invalid'
        ];

        foreach ($invalidAddresses as $address) {
            $this->assertFalse(
                $this->stablecoinProcessor->validateAddress('USDC', $address),
                "Address should be invalid for USDC: $address"
            );
            $this->assertFalse(
                $this->stablecoinProcessor->validateAddress('UST', $address),
                "Address should be invalid for UST: $address"
            );
        }
    }

    public function testStablecoinPriceConversion()
    {
        // Test USDC price (should be close to 1 USD)
        $usdcPrice = $this->priceService->getCurrentPrice('USDC');
        $this->assertIsArray($usdcPrice);
        $this->assertArrayHasKey('rate', $usdcPrice);
        $this->assertGreaterThan(0.95, $usdcPrice['rate']);
        $this->assertLessThan(1.05, $usdcPrice['rate']);

        // Test UST price (should be close to 1 USD)
        $ustPrice = $this->priceService->getCurrentPrice('UST');
        $this->assertIsArray($ustPrice);
        $this->assertArrayHasKey('rate', $ustPrice);
        $this->assertGreaterThan(0.95, $ustPrice['rate']);
        $this->assertLessThan(1.05, $ustPrice['rate']);
    }

    public function testPaymentProcessorIntegration()
    {
        // Test USDC payment through main payment processor
        $result = $this->paymentProcessor->validateTransaction(
            'USDC',
            'dummy_tx_hash',
            '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            10.000000
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));

        // Test UST payment through main payment processor
        $result = $this->paymentProcessor->validateTransaction(
            'UST',
            'dummy_tx_hash',
            'terra1dp0taj85ruc299rkdvzp4z5pfg6z6swaed74e6',
            10.000000
        );

        $this->assertArrayHasKey('status', $result);
        $this->assertTrue(in_array($result['status'], ['pending', 'confirmed']));
    }

    public function testExplorerUrls()
    {
        // Test USDC (Ethereum) explorer URL
        $usdcTx = '0x123abc';
        $usdcUrl = $this->stablecoinProcessor->getExplorerUrl('USDC', $usdcTx);
        $this->assertEquals(
            'https://etherscan.io/tx/0x123abc',
            $usdcUrl
        );

        // Test UST (Terra) explorer URL
        $ustTx = 'ABC123';
        $ustUrl = $this->stablecoinProcessor->getExplorerUrl('UST', $ustTx);
        $this->assertEquals(
            'https://finder.terra.money/tx/ABC123',
            $ustUrl
        );
    }

    public function testInvalidCurrency()
    {
        $this->expectException(\Exception::class);
        $this->stablecoinProcessor->validateUSDCTransaction(
            'dummy_tx_hash',
            10.000000,
            'invalid_address'
        );
    }

    public function testInvalidAmount()
    {
        $this->expectException(\Exception::class);
        $this->paymentProcessor->validateTransaction(
            'USDC',
            'dummy_tx_hash',
            '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            1000001 // Above max amount
        );
    }

    public function testDatabaseIntegration()
    {
        // Test database columns for stablecoin support
        $db = new \PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME,
            DB_USER,
            DB_PASS
        );
        
        // Check currency column
        $stmt = $db->query("SHOW COLUMNS FROM nimipay_invoices LIKE 'currency'");
        $this->assertNotFalse($stmt->fetch());

        // Check exchange rate columns
        $stmt = $db->query("SHOW COLUMNS FROM nimipay_invoices LIKE 'exchange_rate'");
        $this->assertNotFalse($stmt->fetch());
        
        $stmt = $db->query("SHOW COLUMNS FROM nimipay_invoices LIKE 'exchange_timestamp'");
        $this->assertNotFalse($stmt->fetch());

        // Test storing stablecoin transaction
        $id_invoice = uniqid();
        $stmt = $db->prepare("
            INSERT INTO nimipay_invoices 
            (id_invoice, type, value_usd, currency, value, exchange_rate, address) 
            VALUES (?, 'test', 10.00, 'USDC', 10.000000, 1.0, ?)
        ");
        
        $this->assertTrue(
            $stmt->execute([
                $id_invoice,
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
            ])
        );
    }
}
