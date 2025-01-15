# Security Guide

This guide outlines security best practices for implementing the Acuity integration.

## Authentication Security

### OAuth2 Token Storage

1. **Never store tokens in code or version control**
   - Use environment variables or secure key management systems
   - Keep tokens out of logs and error reports

2. **Secure token storage**
   ```typescript
   // DON'T: Store tokens in plaintext
   localStorage.setItem('token', accessToken);

   // DO: Use secure storage methods
   const secureStorage = new SecureTokenStorage();
   await secureStorage.store('token', accessToken);
   ```

3. **Token refresh security**
   - Implement automatic token refresh before expiration
   - Handle refresh failures gracefully
   - Invalidate and remove old tokens

### Client Credentials

1. **Environment variables**
   ```typescript
   // DON'T: Hardcode credentials
   const clientId = 'abc123';
   const clientSecret = 'xyz789';

   // DO: Use environment variables
   const clientId = process.env.ACUITY_CLIENT_ID;
   const clientSecret = process.env.ACUITY_CLIENT_SECRET;
   ```

2. **Configuration validation**
   ```typescript
   function validateConfig(config: AcuityConfig): void {
     if (!config.clientId || !config.clientSecret) {
       throw new Error('Missing required credentials');
     }
     if (!config.redirectUri.startsWith('https://')) {
       throw new Error('Redirect URI must use HTTPS');
     }
   }
   ```

## Webhook Security

### Signature Verification

1. **Always verify signatures**
   ```typescript
   app.post('/webhooks/acuity', (req, res) => {
     const signature = req.headers['x-acuity-signature'];
     if (!signature) {
       res.status(400).send('Missing signature');
       return;
     }

     const payload = JSON.stringify(req.body);
     if (!integration.verifyWebhookSignature(signature, payload)) {
       res.status(400).send('Invalid signature');
       return;
     }
     // Process webhook...
   });
   ```

2. **Use constant-time comparison**
   - The integration uses `crypto.timingSafeEqual` to prevent timing attacks
   - Never use regular string comparison for signatures

### Webhook Endpoints

1. **HTTPS only**
   - Configure your webhook endpoint to require HTTPS
   - Use valid SSL certificates
   - Keep SSL/TLS up to date

2. **Request validation**
   ```typescript
   function validateWebhookRequest(req: Request): void {
     if (!req.body || typeof req.body !== 'object') {
       throw new Error('Invalid request body');
     }
     if (!req.body.type || !req.body.data) {
       throw new Error('Missing required fields');
     }
   }
   ```

## Payment Processing Security

### Data Validation

1. **Validate all payment details**
   ```typescript
   function validatePaymentDetails(details: AcuityPaymentDetails): void {
     if (details.amount <= 0) {
       throw new Error('Invalid amount');
     }
     if (!['USD', 'EUR', 'GBP'].includes(details.currency)) {
       throw new Error('Unsupported currency');
     }
     // Additional validation...
   }
   ```

2. **Sanitize input data**
   ```typescript
   function sanitizeCustomerId(id: string): string {
     return id.replace(/[^a-zA-Z0-9_-]/g, '');
   }
   ```

### Error Handling

1. **Secure error responses**
   ```typescript
   // DON'T: Expose internal errors
   app.use((err, req, res, next) => {
     res.status(500).json({ error: err.stack });
   });

   // DO: Return safe error messages
   app.use((err, req, res, next) => {
     console.error('Internal error:', err);
     res.status(500).json({ error: 'An error occurred' });
   });
   ```

2. **Transaction logging**
   ```typescript
   async function logTransaction(details: PaymentResult): Promise<void> {
     // Log only necessary information
     await logger.info('Payment processed', {
       success: details.success,
       transactionId: details.transactionId,
       timestamp: new Date().toISOString()
     });
   }
   ```

## Network Security

### Request Configuration

1. **Timeout settings**
   ```typescript
   const axiosInstance = axios.create({
     timeout: 10000, // 10 seconds
     maxRedirects: 5
   });
   ```

2. **Rate limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';

   app.use('/webhooks/acuity', rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   }));
   ```

### CORS Configuration

```typescript
// DON'T: Allow all origins
app.use(cors());

// DO: Configure specific origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'x-acuity-signature']
}));
```

## Data Security

### Sensitive Data Handling

1. **PII (Personally Identifiable Information)**
   - Minimize PII collection
   - Encrypt PII in transit and at rest
   - Implement data retention policies

2. **Payment Data**
   - Never store raw payment data
   - Use tokenization when possible
   - Follow PCI DSS guidelines if handling card data

### Logging

1. **Secure logging practices**
   ```typescript
   // DON'T: Log sensitive data
   logger.info(`Processing payment for ${customerEmail}`);

   // DO: Log safely
   logger.info('Processing payment', {
     customerId: hashCustomerId(customerId),
     timestamp: new Date().toISOString()
   });
   ```

2. **Log rotation and retention**
   - Implement log rotation
   - Set appropriate retention periods
   - Secure log storage

## Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://acuityscheduling.com']
  }
}));
```

## Regular Security Maintenance

1. **Dependency updates**
   - Regularly update dependencies
   - Monitor security advisories
   - Use tools like `npm audit`

2. **Security testing**
   - Implement security-focused tests
   - Regular penetration testing
   - Vulnerability scanning

## Incident Response

1. **Prepare an incident response plan**
   - Document procedures
   - Define roles and responsibilities
   - Establish communication channels

2. **Monitor and alert**
   - Implement logging and monitoring
   - Set up alerts for suspicious activity
   - Regular security reviews

## Additional Resources

- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PCI DSS Guidelines](https://www.pcisecuritystandards.org/)
