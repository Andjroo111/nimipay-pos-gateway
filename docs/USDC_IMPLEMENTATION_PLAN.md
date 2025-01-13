# USDC Implementation Plan

## Overview
Adding USDC support to the payment gateway with gas abstraction based on Nimiq wallet's implementation.

## 1. Contract Integration

### 1.1 Smart Contract ABIs
```javascript
// Required Contract ABIs from Nimiq wallet
const USDC_TOKEN_CONTRACT_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function nonces(address owner) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const USDC_TRANSFER_CONTRACT_ABI = [
    'function transfer(address token, uint256 amount, address target, uint256 fee)',
    'function transferWithPermit(address token, uint256 amount, address target, uint256 fee, uint256 value, bytes32 sigR, bytes32 sigS, uint8 sigV)',
    'function getGasAndDataLimits() view returns (tuple(uint256 acceptanceBudget, uint256 preRelayedCallGasLimit, uint256 postRelayedCallGasLimit, uint256 calldataSizeLimit) limits)',
    'function getNonce(address from) view returns (uint256)',
    'function getRequiredRelayGas(bytes4 methodId) view returns (uint256 gas)'
];
```

### 1.2 Contract Addresses
```php
const USDC_CONTRACT_ADDRESSES = [
    'mainnet' => [
        'token' => '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'transfer' => '[TRANSFER_CONTRACT_ADDRESS]'
    ],
    'testnet' => [
        'token' => '[TESTNET_TOKEN_ADDRESS]',
        'transfer' => '[TESTNET_TRANSFER_ADDRESS]'
    ]
];
```

## 2. Components to Implement

### 2.1 USDC Transaction Handler
Create new class: `src/Services/UsdcTransactionHandler.php`
- Handle USDC-specific transaction logic
- Implement gas estimation
- Manage permit signatures
- Handle transaction validation

### 2.2 Gas Abstraction Service
Create new class: `src/Services/GasAbstractionService.php`
- Estimate gas costs
- Handle gas fee payments
- Manage relayer interactions
- Implement fallback mechanisms

### 2.3 Contract Interaction Service
Create new class: `src/Services/ContractInteractionService.php`
- Manage Web3 connections
- Handle contract calls
- Implement event listeners
- Error handling

## 3. Implementation Steps

### 3.1 Backend Changes

1. Update StablecoinProcessor:
```php
class StablecoinProcessor {
    private $usdcHandler;
    private $gasService;
    
    public function processUsdcPayment($amount, $recipient) {
        // 1. Estimate gas
        $gasEstimate = $this->gasService->estimateGas();
        
        // 2. Get permit signature
        $permit = $this->usdcHandler->getPermit($amount);
        
        // 3. Execute transfer with gas abstraction
        return $this->usdcHandler->transferWithPermit(
            $amount,
            $recipient,
            $permit,
            $gasEstimate
        );
    }
}
```

2. Add Gas Fee Handling:
```php
class GasAbstractionService {
    public function estimateGas() {
        // Get current gas price
        $gasPrice = $this->getGasPrice();
        
        // Calculate required gas
        $gasLimit = 65000; // Standard ERC20 transfer
        
        // Add buffer for safety
        return $this->calculateTotalGas($gasPrice, $gasLimit);
    }
    
    public function handleGasPayment($txHash) {
        // Monitor transaction
        // Handle gas reimbursement
        // Manage relayer fees
    }
}
```

3. Update PaymentProcessor:
```php
class PaymentProcessor {
    public function validateUsdcTransaction($txHash, $expectedAmount) {
        // Verify USDC transfer event
        // Check gas payment status
        // Validate permit signature
        // Confirm amount and recipient
    }
}
```

### 3.2 Frontend Updates

1. Add Gas Fee UI:
```javascript
function showUsdcPaymentInfo(invoice, gasEstimate) {
    return `
        <div class="usdc-payment-info">
            <p>Amount: ${invoice.amount} USDC</p>
            <p>Estimated Gas Fee: ${gasEstimate} ETH</p>
            <p>Gas Fee Covered by Service</p>
            <div class="payment-status"></div>
        </div>
    `;
}
```

2. Update Payment Flow:
```javascript
async function processUsdcPayment(invoice) {
    try {
        // 1. Get gas estimate
        const gasEstimate = await getGasEstimate();
        
        // 2. Show payment UI with gas info
        showUsdcPaymentInfo(invoice, gasEstimate);
        
        // 3. Get permit signature
        const permit = await getUsdcPermit(invoice.amount);
        
        // 4. Submit transaction
        const tx = await submitUsdcTransaction(invoice, permit);
        
        // 5. Monitor confirmation
        await monitorTransaction(tx.hash);
        
    } catch (error) {
        handleUsdcError(error);
    }
}
```

## 4. Testing Strategy

### 4.1 Unit Tests
Create: `tests/unit/UsdcTransactionTest.php`
- Test gas estimation
- Test permit signature generation
- Test transaction validation
- Test error handling

### 4.2 Integration Tests
Create: `tests/integration/UsdcPaymentTest.php`
- Test complete payment flow
- Test gas abstraction
- Test contract interactions
- Test frontend integration

### 4.3 Contract Tests
Create: `tests/contract/UsdcContractTest.php`
- Test contract interactions
- Test event handling
- Test permit verification
- Test gas calculations

## 5. Security Considerations

1. Gas Price Protection:
- Implement maximum gas price limits
- Add circuit breakers for high gas
- Monitor gas usage patterns

2. Permit Security:
- Validate permit signatures
- Check permit expiration
- Verify nonce handling

3. Transaction Validation:
- Verify transfer events
- Check recipient addresses
- Validate amounts and decimals

## 6. Deployment Steps

1. Contract Deployment:
```bash
# Deploy transfer contract
npm run deploy:transfer-contract

# Verify contract
npm run verify:contract
```

2. Database Migration:
```sql
-- Add USDC-specific columns
ALTER TABLE transactions
ADD COLUMN gas_fee DECIMAL(20,8),
ADD COLUMN permit_signature TEXT,
ADD COLUMN gas_status VARCHAR(20);
```

3. Configuration Updates:
```php
// Update config
define('USDC_ENABLED', true);
define('GAS_PRICE_LIMIT', '100000000000'); // 100 gwei
define('MAX_GAS_PER_TX', '100000');
```

## 7. Monitoring

1. Gas Usage:
- Track gas costs per transaction
- Monitor gas price fluctuations
- Alert on high gas situations

2. Transaction Status:
- Monitor confirmation times
- Track failed transactions
- Log permit usage

3. Error Handling:
- Log contract errors
- Track gas estimation failures
- Monitor permit rejections

## 8. Future Improvements

1. Gas Optimization:
- Implement batched transfers
- Use gas tokens
- Optimize contract calls

2. User Experience:
- Add gas fee estimates
- Improve error messages
- Add transaction tracking

3. Security:
- Add multi-sig support
- Implement rate limiting
- Add fraud detection

## Next Steps

1. Implement Core Components:
- Create USDC handler
- Implement gas service
- Update frontend

2. Deploy Contracts:
- Deploy transfer contract
- Set up relayer network
- Configure gas handling

3. Testing:
- Run unit tests
- Perform integration testing
- Test gas abstraction

4. Documentation:
- Update API docs
- Add integration guide
- Document gas handling
