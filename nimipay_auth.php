<?php
    
    // Database Configuration
    DB::$user = 'your_db_user';
    DB::$password = 'your_db_password';
    DB::$dbName = 'nimipay_pos';

    // Merchant PoS Configuration
    $merchant_config = [
        // Primary PoS Address (Nimiq 2.0)
        'nim_address' => 'NQ97 XXXX XXXX XXXX XXXX', // Replace with your PoS address
        'merchant_name' => 'Your Store Name',
        'webhook_url' => '', // Optional: URL for payment notifications
        'auto_confirm' => true, // Enable automatic confirmation
        'tx_limit' => 1000, // Maximum transaction amount in USD
    ];

    // Multi-Currency Configuration
    $currency_config = [
        'NIM' => [
            'enabled' => true,
            'rpc_endpoint' => 'https://rpc.nimiq.network',
            'confirmations' => 2, // Number of confirmations required
        ],
        'BTC' => [
            'enabled' => false,
            'lightning_endpoint' => '', // Your Lightning Network endpoint
            'macaroon_path' => '', // LND macaroon path
        ],
        'UST' => [
            'enabled' => false,
            'terra_endpoint' => '', // Terra blockchain endpoint
        ],
        'USDC' => [
            'enabled' => false,
            'eth_endpoint' => '', // Ethereum RPC endpoint
            'contract_address' => '', // USDC contract address
        ]
    ];

    // Security Settings
    $security_config = [
        'require_2fa' => false, // Enable for merchant dashboard
        'notify_email' => '', // Email for notifications
        'allowed_origins' => ['*'], // Restrict to specific domains
        'api_rate_limit' => 100, // Requests per minute
    ];

?>
