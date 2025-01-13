<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * NimiPay API Handler
 */
class NimiPay_API {
    private $api_key;
    private $testmode;
    private $api_url;
    
    /**
     * Constructor
     */
    public function __construct($api_key, $testmode = false) {
        $this->api_key = $api_key;
        $this->testmode = $testmode;
        $this->api_url = $testmode
            ? 'https://testnet-api.nimipay.com/v1'
            : 'https://api.nimipay.com/v1';
    }
    
    /**
     * Create payment
     */
    public function create_payment($data) {
        return $this->request('POST', '/payments', $data);
    }
    
    /**
     * Get payment
     */
    public function get_payment($payment_id) {
        return $this->request('GET', "/payments/{$payment_id}");
    }
    
    /**
     * Get supported currencies
     */
    public function get_currencies() {
        return $this->request('GET', '/currencies');
    }
    
    /**
     * Get exchange rates
     */
    public function get_exchange_rates($base_currency = 'USD') {
        return $this->request('GET', '/exchange-rates', array(
            'base' => $base_currency
        ));
    }
    
    /**
     * Make API request
     */
    private function request($method, $endpoint, $data = null) {
        $url = $this->api_url . $endpoint;
        
        $headers = array(
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'User-Agent' => 'NimiPay WordPress Plugin/' . NIMIPAY_VERSION
        );
        
        $args = array(
            'method' => $method,
            'headers' => $headers,
            'timeout' => 30,
            'sslverify' => true
        );
        
        if ($data !== null) {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $code = wp_remote_retrieve_response_code($response);
        
        if ($code >= 400) {
            $error = json_decode($body, true);
            throw new Exception(
                isset($error['message']) ? $error['message'] : 'Unknown error occurred'
            );
        }
        
        return json_decode($body, true);
    }
    
    /**
     * Generate signature
     */
    public function generate_signature($payload) {
        return hash_hmac('sha256', $payload, $this->api_key);
    }
    
    /**
     * Format amount
     */
    public function format_amount($amount, $currency) {
        switch ($currency) {
            case 'BTC':
                return (int) ($amount * 100000000); // 8 decimals
                
            case 'USDC':
            case 'UST':
                return (int) ($amount * 1000000); // 6 decimals
                
            default:
                return (int) ($amount * 100); // 2 decimals
        }
    }
    
    /**
     * Format display amount
     */
    public function format_display_amount($amount, $currency) {
        switch ($currency) {
            case 'BTC':
                return $amount / 100000000; // 8 decimals
                
            case 'USDC':
            case 'UST':
                return $amount / 1000000; // 6 decimals
                
            default:
                return $amount / 100; // 2 decimals
        }
    }
    
    /**
     * Get currency details
     */
    public function get_currency_details($currency) {
        $currencies = array(
            'BTC' => array(
                'name' => 'Bitcoin',
                'decimals' => 8,
                'min_amount' => 0.00001,
                'max_amount' => 100,
                'confirmations' => array(
                    'mainnet' => 2,
                    'testnet' => 1
                )
            ),
            'USDC' => array(
                'name' => 'USD Coin',
                'decimals' => 6,
                'min_amount' => 1,
                'max_amount' => 1000000,
                'confirmations' => array(
                    'mainnet' => 12,
                    'testnet' => 5
                )
            ),
            'UST' => array(
                'name' => 'Terra USD',
                'decimals' => 6,
                'min_amount' => 1,
                'max_amount' => 1000000,
                'confirmations' => array(
                    'mainnet' => 15,
                    'testnet' => 5
                )
            )
        );
        
        return isset($currencies[$currency]) ? $currencies[$currency] : null;
    }
    
    /**
     * Validate amount
     */
    public function validate_amount($amount, $currency) {
        $details = $this->get_currency_details($currency);
        if (!$details) {
            return false;
        }
        
        $amount = $this->format_display_amount($amount, $currency);
        
        return $amount >= $details['min_amount'] && $amount <= $details['max_amount'];
    }
    
    /**
     * Get required confirmations
     */
    public function get_required_confirmations($currency) {
        $details = $this->get_currency_details($currency);
        if (!$details) {
            return 1;
        }
        
        return $details['confirmations'][$this->testmode ? 'testnet' : 'mainnet'];
    }
    
    /**
     * Log API request
     */
    private function log($message, $level = 'info') {
        if (function_exists('wc_get_logger')) {
            $logger = wc_get_logger();
            $context = array('source' => 'nimipay');
            $logger->log($level, $message, $context);
        }
    }
}
