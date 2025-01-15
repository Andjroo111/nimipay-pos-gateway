import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AcuityIntegration } from '../../AcuityIntegration';
import { AcuityConfig, WebhookConfig, AcuityPaymentDetails } from '../../types';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AcuityIntegration', () => {
  let integration: AcuityIntegration;

  const mockConfig: AcuityConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    scope: ['appointments', 'payments']
  };

  const mockWebhookConfig: WebhookConfig = {
    url: 'https://example.com/webhook',
    secret: 'test-webhook-secret',
    events: ['payment.succeeded', 'payment.failed', 'refund.succeeded']
  };

  beforeEach(async () => {
    integration = new AcuityIntegration(mockConfig, mockWebhookConfig);
    jest.clearAllMocks();

    // Mock successful auth initialization
    const mockToken = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: mockConfig.scope.join(' ')
    };

    mockedAxios.post.mockResolvedValueOnce({ data: mockToken });
    await integration.handleAuthCallback('valid-code');
  });

  describe('Authentication', () => {
    it('should generate correct auth URL', () => {
      const authUrl = integration.getAuthUrl();
      expect(authUrl).toContain('acuityscheduling.com/oauth2/authorize');
      expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
      expect(authUrl).toContain(`scope=${mockConfig.scope.join('+')}`);
    });

    it('should handle auth callback successfully', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockToken });

      await integration.handleAuthCallback('valid-code');
      expect(integration.isAuthenticated()).toBe(true);
    });
  });

  describe('Payment Processing', () => {
    const mockPaymentDetails: AcuityPaymentDetails = {
      amount: 100,
      currency: 'USD',
      appointmentId: 123,
      customerId: 'cust_123'
    };

    it('should process payment successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100,
          currency: 'USD',
          customerId: 'cust_123',
          timestamp: new Date().toISOString()
        }
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'pi_123' } }) // Payment intent creation
        .mockResolvedValueOnce({ data: { transactionId: 'tx_123' } }); // Nimipay payment processing

      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      const result = await integration.processPayment(mockPaymentDetails);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx_123');
      expect(result.amount).toBe(100);
    });

    it('should handle payment failures', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100,
          currency: 'USD',
          customerId: 'cust_123',
          timestamp: new Date().toISOString()
        }
      });

      // Mock payment intent creation to succeed but payment processing to fail
      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'pi_123' } }) // Payment intent creation succeeds
        .mockRejectedValueOnce(new Error('Payment failed')); // Payment processing fails

      const result = await integration.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });
  });

  describe('Webhook Handling', () => {
    it('should verify webhook signatures', () => {
      const payload = JSON.stringify({ type: 'payment.succeeded' });
      const hmac = require('crypto').createHmac('sha256', mockWebhookConfig.secret);
      const signature = hmac.update(payload).digest('hex');

      const isValid = integration.verifyWebhookSignature(signature, payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signatures', () => {
      const payload = JSON.stringify({ type: 'payment.succeeded' });
      const signature = 'invalid-signature';

      const isValid = integration.verifyWebhookSignature(signature, payload);
      expect(isValid).toBe(false);
    });

    it('should handle payment.succeeded webhook', async () => {
      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      const event = {
        type: 'payment.succeeded',
        data: {
          appointmentId: 123,
          status: 'succeeded',
          transactionId: 'tx_123',
          amount: 100,
          currency: 'USD',
          timestamp: new Date().toISOString()
        },
        signature: 'valid-signature'
      };

      await integration.handleWebhook(event);
      expect(mockedAxios.put).toHaveBeenCalled();
    });
  });
});
