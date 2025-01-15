import { AcuityAuth } from './auth/AcuityAuth';
import { AcuityPaymentProcessor } from './payment/AcuityPaymentProcessor';
import {
  AcuityConfig,
  WebhookConfig,
  WebhookEvent,
  AcuityPaymentDetails,
  PaymentResult
} from './types';
import crypto from 'crypto';

export class AcuityIntegration {
  private auth: AcuityAuth;
  private paymentProcessor: AcuityPaymentProcessor;
  private webhookConfig?: WebhookConfig;

  constructor(config: AcuityConfig, webhookConfig?: WebhookConfig) {
    this.auth = new AcuityAuth(config);
    this.paymentProcessor = new AcuityPaymentProcessor(this.auth);
    this.webhookConfig = webhookConfig;
  }

  async initialize(): Promise<void> {
    await this.auth.initialize();
  }

  getAuthUrl(): string {
    return this.auth.getAuthUrl();
  }

  async handleAuthCallback(code: string): Promise<void> {
    await this.auth.handleAuthCallback(code);
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  getWebhookEndpoint(): string {
    if (!this.webhookConfig) {
      throw new Error('Webhook configuration not provided');
    }
    return this.webhookConfig.endpoint || this.webhookConfig.url || '';
  }

  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.webhookConfig) {
      throw new Error('Webhook configuration not provided');
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookConfig.secret);
      const calculatedSignature = hmac.update(payload).digest('hex');

      // Convert both signatures to buffers of the same length
      const signatureBuffer = Buffer.from(signature, 'hex');
      const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

      // Ensure both buffers have the same length before comparison
      if (signatureBuffer.length !== calculatedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, calculatedBuffer);
    } catch (error) {
      console.error('Webhook signature verification failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    if (!event.type) {
      throw new Error('Invalid webhook event: missing type');
    }

    const appointmentId = event.data?.appointmentId;
    if (!appointmentId) {
      throw new Error('Invalid webhook event: missing appointmentId');
    }

    switch (event.type) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(appointmentId);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(appointmentId);
        break;
      case 'refund.succeeded':
        await this.handleRefundSucceeded(appointmentId);
        break;
      default:
        console.warn('Unhandled webhook event type:', event.type);
    }
  }

  private async handlePaymentSucceeded(appointmentId: number): Promise<void> {
    await this.paymentProcessor.updateAppointmentPaymentStatus(appointmentId, true);
  }

  private async handlePaymentFailed(appointmentId: number): Promise<void> {
    await this.paymentProcessor.updateAppointmentPaymentStatus(appointmentId, false);
  }

  private async handleRefundSucceeded(appointmentId: number): Promise<void> {
    const appointment = await this.paymentProcessor.getAppointmentDetails(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    await this.paymentProcessor.refundPayment(appointmentId);
  }

  async processPayment(details: AcuityPaymentDetails): Promise<PaymentResult> {
    return this.paymentProcessor.processPayment(details);
  }

  async refundPayment(appointmentId: number): Promise<PaymentResult> {
    return this.paymentProcessor.refundPayment(appointmentId);
  }
}
