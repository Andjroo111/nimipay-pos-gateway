/// <reference types="jest" />

import { AcuityPaymentProcessor } from '../../payment/AcuityPaymentProcessor';
import { AcuityAuth } from '../../auth/AcuityAuth';
import { AcuityPaymentDetails } from '../../types';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AcuityPaymentProcessor', () => {
  let processor: AcuityPaymentProcessor;
  let mockAuth: jest.Mocked<AcuityAuth>;

  const mockPaymentDetails: AcuityPaymentDetails = {
    amount: 100,
    currency: 'USD',
    appointmentId: 123,
    customerId: 'cust_123'
  };

  beforeEach(() => {
    mockAuth = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
      handleAuthCallback: jest.fn().mockResolvedValue(undefined),
      getAuthUrl: jest.fn().mockReturnValue('http://test.url'),
      isAuthenticated: jest.fn().mockReturnValue(true),
      logout: jest.fn()
    } as unknown as jest.Mocked<AcuityAuth>;

    processor = new AcuityPaymentProcessor(mockAuth);
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should handle non-existent appointment', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle already paid appointment', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: true,
          price: 100
        }
      });

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment is already paid');
    });

    it('should handle payment intent creation failure', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100
        }
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('Failed to create payment intent'));

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create payment intent');
    });

    it('should handle Nimipay payment processing failure', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100
        }
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'pi_123' } }) // Payment intent creation
        .mockRejectedValueOnce(new Error('Payment failed')); // Nimipay payment processing

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });

    it('should handle appointment status update failure', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100
        }
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'pi_123' } }) // Payment intent creation
        .mockResolvedValueOnce({ data: { transactionId: 'tx_123' } }); // Nimipay payment processing

      mockedAxios.put.mockRejectedValueOnce(new Error('Failed to update status'));

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update status');
    });

    it('should process payment successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100
        }
      });

      mockedAxios.post
        .mockResolvedValueOnce({ data: { id: 'pi_123' } }) // Payment intent creation
        .mockResolvedValueOnce({ data: { transactionId: 'tx_123' } }); // Nimipay payment processing

      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      const result = await processor.processPayment(mockPaymentDetails);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx_123');
      expect(result.amount).toBe(100);
    });
  });

  describe('refundPayment', () => {
    it('should handle non-existent appointment', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      const result = await processor.refundPayment(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment not found');
    });

    it('should handle unpaid appointment refund attempt', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: false,
          price: 100
        }
      });

      const result = await processor.refundPayment(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Appointment is not paid');
    });

    it('should handle refund processing failure', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: true,
          price: 100
        }
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('Refund failed'));

      const result = await processor.refundPayment(123);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund failed');
    });

    it('should handle appointment status update failure after refund', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: true,
          price: 100
        }
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: { transactionId: 'refund_123' }
      });

      mockedAxios.put.mockRejectedValueOnce(new Error('Failed to update status'));

      const result = await processor.refundPayment(123);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update status');
    });

    it('should process refund successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 123,
          paid: true,
          price: 100
        }
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: { transactionId: 'refund_123' }
      });

      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      const result = await processor.refundPayment(123);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('refund_123');
      expect(result.amount).toBe(100);
    });
  });
});
