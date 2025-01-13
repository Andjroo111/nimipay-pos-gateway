# Bitcoin Integration Verification Checklist

## Pre-Deployment Verification

### 1. Database Migration
- [ ] Run migration script:
  ```bash
  mysql -u [username] -p [database] < migrations/01_add_currency_support.sql
  ```
- [ ] Verify new columns:
  - currency (varchar)
  - value_usd (decimal)
  - exchange_rate (decimal)
  - exchange_timestamp (timestamp)
- [ ] Confirm indexes are created:
  - idx_currency
  - idx_status_currency

### 2. Configuration
- [ ] Verify BTC configuration in currency_config.php:
  - Correct decimal places (8)
  - Proper confirmation requirement (3 blocks)
  - Valid address regex pattern
  - Appropriate min/max amounts
  - Working RPC endpoint

### 3. Price Service
- [ ] Test price API endpoints:
  - Primary: Coinbase API
  - Fallback: CoinGecko API
- [ ] Verify rate caching:
  - Cache duration (5 minutes)
  - Proper fallback behavior
  - Rate freshness checks

### 4. Transaction Processing
- [ ] Confirm BTC transaction validation:
  - 3-block confirmation requirement
  - Proper amount validation
  - Address format verification
  - Transaction hash validation
- [ ] Test error handling:
  - Invalid addresses
  - Insufficient confirmations
  - Network issues
  - RPC failures

### 5. Frontend Integration
- [ ] Verify currency selector:
  - Proper currency switching
  - Correct balance display
  - Price updates
- [ ] Test payment flow:
  - BTC address generation
  - QR code display
  - Payment monitoring
  - Confirmation updates

### 6. Security Measures
- [ ] Validate input sanitization:
  - Address validation
  - Amount validation
  - Transaction hash validation
- [ ] Check rate limiting:
  - API call limits
  - Price update frequency
  - Transaction verification intervals
- [ ] Verify error handling:
  - Invalid input responses
  - API failure handling
  - Transaction monitoring timeouts

## Running Verification Tests

1. Run Integration Tests:
```bash
./vendor/bin/phpunit tests/integration/CryptoPaymentTest.php
```

2. Run BTC Verification Script:
```bash
php tests/verification/btc_integration_verify.php
```

3. Monitor Test Results:
- All database checks passing
- Transaction processing verified
- Price service functioning
- Address validation correct
- Security measures active

## Production Deployment Steps

1. Database Update:
```bash
# Backup existing database
mysqldump -u [username] -p [database] > backup_[date].sql

# Apply migration
mysql -u [username] -p [database] < migrations/01_add_currency_support.sql
```

2. Configuration Deployment:
```bash
# Verify config files
cp config/currency_config.php /production/path/
chmod 644 /production/path/currency_config.php
```

3. Service Deployment:
```bash
# Deploy updated services
cp -r src/Services/* /production/path/src/Services/
chmod 755 /production/path/src/Services/*
```

4. Frontend Update:
```bash
# Deploy updated frontend files
cp nimipay.js /production/path/
cp nimipay.php /production/path/
```

## Post-Deployment Verification

1. Monitor First Transactions:
- [ ] Watch for successful BTC payments
- [ ] Verify confirmation counting
- [ ] Check exchange rate updates
- [ ] Confirm database entries

2. Check Error Logs:
- [ ] Monitor for unexpected errors
- [ ] Verify error handling
- [ ] Check rate limiting effectiveness

3. Performance Monitoring:
- [ ] Track API response times
- [ ] Monitor database performance
- [ ] Check memory usage
- [ ] Verify cache effectiveness

## Security Reminders

1. Critical Checks:
- [ ] BTC addresses properly validated
- [ ] Transaction amounts verified
- [ ] Confirmation requirements enforced
- [ ] Rate limiting active

2. Data Protection:
- [ ] Sensitive data encrypted
- [ ] Logs properly sanitized
- [ ] Error messages safe
- [ ] API keys secured

3. Monitoring:
- [ ] Error logging enabled
- [ ] Transaction monitoring active
- [ ] Rate limiting tracked
- [ ] Price updates logged

## Rollback Plan

In case of critical issues:

1. Database Rollback:
```bash
mysql -u [username] -p [database] < backup_[date].sql
```

2. Code Rollback:
```bash
git checkout [previous_stable_tag]
cp -r * /production/path/
```

3. Monitoring Period:
- Monitor error logs
- Watch transaction processing
- Check database performance
- Verify API functionality

Remember to update this checklist based on specific deployment requirements and findings during testing.
