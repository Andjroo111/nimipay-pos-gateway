# Nimipay PoS

A Point of Sale (PoS) implementation for Nimiq blockchain payments.

## Features

- PoS-optimized transaction processing with 2-block confirmation
- Decimal place handling for PoS (4 decimal places)
- Hub API integration for secure wallet interactions
- Real-time price conversion (USD/NIM)
- Invoice management and tracking
- Transaction status monitoring

## Multi-Currency Support

Nimipay PoS supports multiple cryptocurrencies:
- NIM (Nimiq 2.0)
- BTC (Bitcoin)
- UST (TerraUSD)
- USDC (USD Coin)

Each currency has specific configuration requirements detailed below.

## Merchant Setup

1. PoS Wallet Configuration:
   - Generate a dedicated PoS wallet address (NQ97 prefix required)
   - Ensure wallet has sufficient balance for transaction fees
   - Enable auto-confirmation for faster processing
   - Set up webhook notifications (optional)

2. Multi-Currency Configuration:
   - NIM: Uses native Nimiq 2.0 PoS protocol
   - BTC: Configure Lightning Network endpoints
   - UST/USDC: Set up Terra/ERC-20 bridges

3. Security Settings:
   - Enable 2FA for merchant dashboard
   - Set transaction limits
   - Configure allowed payment methods
   - Set up email notifications

## Setup

1. Database Configuration:
   - Import `nimipay.sql` to create required tables
   - Update database credentials in `nimipay_auth.php`

2. Configure PoS settings in `nimipay_auth.php`:
   - Set your PoS wallet address (must start with NQ97 for mainnet)
   - Configure RPC endpoint if needed

3. Deploy the files to your web server:
   ```
   nimipay.php
   nimipay_auth.php
   nimipay.js
   nimipay.css
   index.html
   ```

## Usage

1. Add payment button to your site:
   ```html
   <button id="np-add-item">Pay with NIM</button>
   ```

2. Initialize Nimipay:
   ```html
   <script src="nimipay.js"></script>
   ```

3. Process payments:
   - Customer clicks payment button
   - Connects their Nimiq wallet
   - Confirms payment
   - Transaction is processed with 2-block confirmation
   - Order is activated upon confirmation

## API Endpoints

- `/nimipay.php?action=sendUserAddress` - Wallet connection
- `/nimipay.php?action=npAddItem` - Create new invoice
- `/nimipay.php?action=sendTxHash` - Process transaction
- `/nimipay.php?action=validateTx` - Validate transaction status

## Development

To run locally:
1. Set up a local web server (e.g., Apache, Nginx)
2. Configure database connection
3. Deploy files to web root
4. Access via localhost

## Testing

Basic integration tests are included for core functionality:
- Wallet integration
- Transaction processing
- Invoice management

Run tests:
```bash
./run_tests.sh
