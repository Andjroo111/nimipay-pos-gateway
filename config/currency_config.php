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
            'rpc_endpoint' => 'https://btc-rpc.example.com',
            'explorer_tx_url' => 'https://blockstream.info/tx/%s',
            'validation' => [
                'address_regex' => '/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/',
                'min_amount' => 0.00001,
                'max_amount' => 100
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
        ],
        'USDC' => [
            'name' => 'USD Coin',
            'decimals' => 6,
            'min_confirmations' => 12, // Ethereum confirmations
            'rpc_endpoint' => 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
            'explorer_tx_url' => 'https://etherscan.io/tx/%s',
            'contract_address' => '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract
            'validation' => [
                'address_regex' => '/^0x[a-fA-F0-9]{40}$/', // Ethereum address format
                'min_amount' => 1,
                'max_amount' => 1000000
            ],
            'price_apis' => [
                'primary' => [
                    'url' => 'https://api.coinbase.com/v2/prices/USDC-USD/spot',
                    'response_key' => 'data.amount'
                ],
                'fallback' => [
                    'url' => 'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd',
                    'response_key' => 'usd-coin.usd'
                ]
            ],
            'gas_settings' => [
                'limit' => 65000,
                'price_multiplier' => 1.1 // 10% buffer for gas price
            ]
        ],
        'UST' => [
            'name' => 'TerraUSD',
            'decimals' => 6,
            'min_confirmations' => 15, // Terra blockchain confirmations
            'rpc_endpoint' => 'https://terra-rpc.example.com',
            'explorer_tx_url' => 'https://finder.terra.money/tx/%s',
            'validation' => [
                'address_regex' => '/^terra[a-zA-Z0-9]{39}$/', // Terra address format
                'min_amount' => 1,
                'max_amount' => 1000000
            ],
            'price_apis' => [
                'primary' => [
                    'url' => 'https://api.coingecko.com/api/v3/simple/price?ids=terrausd&vs_currencies=usd',
                    'response_key' => 'terrausd.usd'
                ],
                'fallback' => [
                    'url' => 'https://api.binance.com/api/v3/ticker/price?symbol=USTUSDT',
                    'response_key' => 'price'
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
