<?php

namespace Nimipay\Services;

class PriceService {
    private $config;
    private $cache = [];
    private $lastFetch = [];

    public function __construct() {
        $this->config = require __DIR__ . '/../../config/currency_config.php';
    }

    /**
     * Get current price for a currency with fallback support
     * 
     * @param string $currency Currency code (e.g., 'NIM', 'BTC')
     * @return array Price data with rate and timestamp
     * @throws \Exception If price cannot be fetched
     */
    public function getCurrentPrice($currency) {
        // Check cache first
        if ($this->isPriceCached($currency)) {
            return $this->cache[$currency];
        }

        $currencyConfig = $this->config['currencies'][$currency] ?? null;
        if (!$currencyConfig) {
            throw new \Exception("Unsupported currency: {$currency}");
        }

        // Try primary API first
        try {
            $price = $this->fetchFromApi(
                $currencyConfig['price_apis']['primary']['url'],
                $currencyConfig['price_apis']['primary']['response_key']
            );
            return $this->cachePrice($currency, $price);
        } catch (\Exception $e) {
            // Log primary API failure
            error_log("Primary price API failed for {$currency}: " . $e->getMessage());
        }

        // Try fallback API
        try {
            $price = $this->fetchFromApi(
                $currencyConfig['price_apis']['fallback']['url'],
                $currencyConfig['price_apis']['fallback']['response_key']
            );
            return $this->cachePrice($currency, $price);
        } catch (\Exception $e) {
            throw new \Exception("Failed to fetch price for {$currency}: " . $e->getMessage());
        }
    }

    /**
     * Convert amount between USD and crypto
     * 
     * @param float $amount Amount to convert
     * @param string $currency Currency code
     * @param bool $toCrypto If true, converts USD to crypto; if false, crypto to USD
     * @return float Converted amount
     */
    public function convertAmount($amount, $currency, $toCrypto = true) {
        $price = $this->getCurrentPrice($currency);
        $decimals = $this->config['currencies'][$currency]['decimals'];
        
        if ($toCrypto) {
            // USD to crypto
            $cryptoAmount = $amount / $price['rate'];
            return round($cryptoAmount, $decimals);
        } else {
            // Crypto to USD
            return round($amount * $price['rate'], 2);
        }
    }

    /**
     * Format amount according to currency specifications
     * 
     * @param float $amount Amount to format
     * @param string $currency Currency code
     * @return string Formatted amount
     */
    public function formatAmount($amount, $currency) {
        $decimals = $this->config['currencies'][$currency]['decimals'];
        return number_format($amount, $decimals, '.', '');
    }

    /**
     * Validate exchange rate freshness
     * 
     * @param string $currency Currency to check
     * @return bool True if rate is fresh, false if needs update
     */
    public function isRateFresh($currency) {
        if (!isset($this->lastFetch[$currency])) {
            return false;
        }

        $timeout = $this->config['settings']['exchange_rate_timeout'];
        return (time() - $this->lastFetch[$currency]) < $timeout;
    }

    private function isPriceCached($currency) {
        if (!isset($this->cache[$currency]) || !isset($this->lastFetch[$currency])) {
            return false;
        }

        $cacheDuration = $this->config['settings']['price_cache_duration'];
        return (time() - $this->lastFetch[$currency]) < $cacheDuration;
    }

    private function cachePrice($currency, $price) {
        $this->cache[$currency] = [
            'rate' => $price,
            'timestamp' => time()
        ];
        $this->lastFetch[$currency] = time();
        return $this->cache[$currency];
    }

    private function fetchFromApi($url, $responseKey) {
        $response = file_get_contents($url);
        if ($response === false) {
            throw new \Exception("Failed to fetch from API: {$url}");
        }

        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Invalid JSON response from API");
        }

        // Parse nested response key (e.g., 'data.amount' or 'nimiq.usd')
        $value = $data;
        foreach (explode('.', $responseKey) as $key) {
            if (!isset($value[$key])) {
                throw new \Exception("Missing key in API response: {$responseKey}");
            }
            $value = $value[$key];
        }

        if (!is_numeric($value)) {
            throw new \Exception("Invalid price value in API response");
        }

        return (float)$value;
    }
}
