<?php

return [
    // Currency configurations
    'currencies' => [
        'NIM' => [
            'name' => 'Nimiq',
            'decimals' => 4, // 1e4 decimal places
            'min_confirmations' => 2, // PoS requires 2 blocks
            'rpc_endpoint' => 'https://rpc.nimiq.com',
            'explorer_tx_url' => 'https://explorer.nimiq.com/transaction/%s',
            'validation' => [
                'address_regex' => '/^NQ[0-9]{2}/', // Nimiq address format
                'min_amount' => 0.00001,
                'max_amount' => 1000000
            ],
            'price_apis' => [
                'primary' => [
                    'url' => 'https://api.nimiq.com/price/usd',
                    'response_key' => 'nim_qc'
                ],
                'fallback' => [
                    'url' => 'https://api.coingecko.com/api/v3/simple/price?ids=nimiq&vs_currencies=usd',
                    'response_key' => 'nimiq.usd'
                ]
            ]
        ],
        'BTC' => [
            'name' => 'Bitcoin',
            'decimals' => 8, // 1e8 satoshis
            'min_confirmations' => 3, // More confirmations for higher value
            'rpc_endpoint' => 'https://btc-rpc.example.com', // To be configured by merchant
            'explorer_tx_url' => 'https://blockstream.info/tx/%s',
            'validation' => [
                'address_regex' => '/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/', // Bitcoin address format
                'min_amount' => 0.00001,
                'max_amount' => 100 // Lower max amount for safety
            ],
            'price_apis' => [
                'primary' => [
                    'url' => 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
                    'response_key' => 'data.amount'
                ],
                'fallback' => [
                    'url' => 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                    'response_key' => 'bitcoin.usd'
                ]
            ]
        ]
    ],

    // Global settings
    'settings' => [
        'price_cache_duration' => 300, // Cache prices for 5 minutes
        'max_price_deviation' => 0.05, // Maximum 5% price deviation between APIs
        'default_currency' => 'NIM',
        'exchange_rate_timeout' => 30, // Rates older than 30 seconds require refresh
        'max_payment_window' => 3600 // 1 hour to complete payment
    ],

    // Error messages
    'errors' => [
        'invalid_address' => 'Invalid %s address format',
        'amount_too_low' => 'Amount below minimum for %s',
        'amount_too_high' => 'Amount above maximum for %s',
        'insufficient_confirmations' => 'Transaction requires %d confirmations',
        'price_deviation' => 'Price deviation too high, try again',
        'rate_expired' => 'Exchange rate expired, please refresh'
    ]
];
