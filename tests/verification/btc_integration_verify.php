<?php

require_once __DIR__ . '/../../vendor/autoload.php';

use Nimipay\Services\PaymentProcessor;
use Nimipay\Services\PriceService;

class BTCIntegrationVerification {
    private $paymentProcessor;
    private $priceService;
    private $results = [];
    private $errors = [];

    public function __construct() {
        $this->paymentProcessor = new PaymentProcessor();
        $this->priceService = new PriceService();
    }

    public function runVerification() {
        echo "Starting BTC Integration Verification...\n\n";

        // 1. Database Verification
        $this->verifyDatabase();

        // 2. Transaction Processing
        $this->verifyTransactionProcessing();

        // 3. Price Service
        $this->verifyPriceService();

        // 4. Address Validation
        $this->verifyAddressValidation();

        // 5. Security Checks
        $this->verifySecurityMeasures();

        $this->printResults();
    }

    private function verifyDatabase() {
        echo "Verifying Database Structure...\n";
        
        try {
            $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
            
            // Check currency column
            $stmt = $db->query("SHOW COLUMNS FROM nimipay_invoices LIKE 'currency'");
            $this->results['database']['currency_column'] = $stmt->fetch() !== false;

            // Check exchange rate columns
            $stmt = $db->query("SHOW COLUMNS FROM nimipay_invoices LIKE 'exchange_rate'");
            $this->results['database']['exchange_rate_column'] = $stmt->fetch() !== false;

            // Verify indexes
            $stmt = $db->query("SHOW INDEX FROM nimipay_invoices WHERE Key_name = 'idx_currency'");
            $this->results['database']['currency_index'] = $stmt->fetch() !== false;

            echo "Database verification complete.\n";
        } catch (PDOException $e) {
            $this->errors['database'] = $e->getMessage();
        }
    }

    private function verifyTransactionProcessing() {
        echo "Verifying Transaction Processing...\n";

        try {
            // Test BTC transaction validation
            $result = $this->paymentProcessor->validateTransaction(
                'BTC',
                'test_tx_hash',
                'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
                0.001
            );

            $this->results['transaction']['validation'] = isset($result['status']);
            $this->results['transaction']['confirmations'] = 
                $result['status'] === 'pending' ? 
                $result['required_confirmations'] === 3 : true;

        } catch (Exception $e) {
            $this->errors['transaction'] = $e->getMessage();
        }
    }

    private function verifyPriceService() {
        echo "Verifying Price Service...\n";

        try {
            // Test price fetching
            $btcPrice = $this->priceService->getCurrentPrice('BTC');
            $this->results['price']['fetch'] = isset($btcPrice['rate']);

            // Test rate freshness
            $this->results['price']['freshness'] = $this->priceService->isRateFresh('BTC');

            // Test conversion
            $usdAmount = 100;
            $btcAmount = $this->priceService->convertAmount($usdAmount, 'BTC', true);
            $this->results['price']['conversion'] = $btcAmount > 0;

            // Test formatting
            $formattedAmount = $this->priceService->formatAmount(1.23456789, 'BTC');
            $this->results['price']['formatting'] = $formattedAmount === '1.23456789';

        } catch (Exception $e) {
            $this->errors['price'] = $e->getMessage();
        }
    }

    private function verifyAddressValidation() {
        echo "Verifying Address Validation...\n";

        try {
            // Valid BTC addresses
            $validAddresses = [
                'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
                '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
                '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
            ];

            // Invalid BTC addresses
            $invalidAddresses = [
                'invalid_address',
                'bc1invalid',
                '1234567890'
            ];

            $this->results['address'] = [
                'valid' => 0,
                'invalid' => 0
            ];

            foreach ($validAddresses as $address) {
                try {
                    $this->paymentProcessor->validateTransaction('BTC', 'test_hash', $address, 0.001);
                    $this->results['address']['valid']++;
                } catch (Exception $e) {
                    $this->errors['address_valid'][] = $e->getMessage();
                }
            }

            foreach ($invalidAddresses as $address) {
                try {
                    $this->paymentProcessor->validateTransaction('BTC', 'test_hash', $address, 0.001);
                } catch (Exception $e) {
                    $this->results['address']['invalid']++;
                }
            }

        } catch (Exception $e) {
            $this->errors['address'] = $e->getMessage();
        }
    }

    private function verifySecurityMeasures() {
        echo "Verifying Security Measures...\n";

        try {
            // Test amount limits
            $config = require __DIR__ . '/../../config/currency_config.php';
            $btcConfig = $config['currencies']['BTC'];

            $this->results['security'] = [
                'min_amount' => isset($btcConfig['validation']['min_amount']),
                'max_amount' => isset($btcConfig['validation']['max_amount']),
                'confirmations' => $btcConfig['min_confirmations'] === 3,
                'address_regex' => !empty($btcConfig['validation']['address_regex'])
            ];

            // Test rate limiting
            $startTime = microtime(true);
            for ($i = 0; $i < 5; $i++) {
                $this->priceService->getCurrentPrice('BTC');
            }
            $endTime = microtime(true);
            $this->results['security']['rate_limiting'] = ($endTime - $startTime) > 1;

        } catch (Exception $e) {
            $this->errors['security'] = $e->getMessage();
        }
    }

    private function printResults() {
        echo "\nVerification Results:\n";
        echo "===================\n\n";

        foreach ($this->results as $category => $tests) {
            echo ucfirst($category) . " Verification:\n";
            foreach ($tests as $test => $result) {
                $status = $result ? "✓ PASS" : "✗ FAIL";
                echo "  - " . str_pad(ucfirst($test), 20) . ": " . $status . "\n";
            }
            if (isset($this->errors[$category])) {
                echo "  ! Error: " . $this->errors[$category] . "\n";
            }
            echo "\n";
        }

        // Print overall status
        $totalTests = $this->countTests($this->results);
        $passedTests = $this->countPassedTests($this->results);
        echo "Overall Status: " . $passedTests . "/" . $totalTests . " tests passed\n";
        
        if (count($this->errors) > 0) {
            echo "\nWarnings/Errors:\n";
            foreach ($this->errors as $category => $error) {
                echo "- $category: $error\n";
            }
        }
    }

    private function countTests($results) {
        $count = 0;
        array_walk_recursive($results, function($item) use (&$count) {
            if (is_bool($item)) $count++;
        });
        return $count;
    }

    private function countPassedTests($results) {
        $count = 0;
        array_walk_recursive($results, function($item) use (&$count) {
            if ($item === true) $count++;
        });
        return $count;
    }
}

// Run verification
$verifier = new BTCIntegrationVerification();
$verifier->runVerification();
