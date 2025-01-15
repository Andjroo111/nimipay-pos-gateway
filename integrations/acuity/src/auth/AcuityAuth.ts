import axios from 'axios';
import { AcuityConfig, AcuityAuthResponse } from '../types';

export class AcuityAuth {
  private config: AcuityConfig;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiry?: Date;
  private storageKey = 'nimipay_acuity_auth';

  constructor(config: AcuityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const storedAuth = localStorage.getItem(this.storageKey);
      if (!storedAuth) {
        return;
      }

      const auth = JSON.parse(storedAuth);
      if (this.validateStoredAuth(auth)) {
        this.updateAuthState(auth);
      } else {
        this.clearAuthState();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to initialize Acuity auth: ${errorMessage}`);
      this.clearAuthState();
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.accessToken || !this.tokenExpiry) {
      throw new Error('No authentication token available');
    }

    if (this.tokenExpiry < new Date()) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      redirect_uri: this.config.redirectUri
    });

    return `https://acuityscheduling.com/oauth2/authorize?${params}`;
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      const response = await axios.post<AcuityAuthResponse>(
        'https://acuityscheduling.com/oauth2/token',
        {
          grant_type: 'authorization_code',
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri
        }
      );

      this.updateAuthState(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to exchange authorization code: ${errorMessage}`);
      this.clearAuthState();
      throw new Error('Failed to exchange authorization code');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<AcuityAuthResponse>(
        'https://acuityscheduling.com/oauth2/token',
        {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        }
      );

      this.updateAuthState(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to refresh access token: ${errorMessage}`);
      this.clearAuthState();
      throw new Error('Failed to refresh access token');
    }
  }

  private updateAuthState(auth: AcuityAuthResponse): void {
    this.accessToken = auth.access_token;
    this.refreshToken = auth.refresh_token;
    this.tokenExpiry = new Date(Date.now() + auth.expires_in * 1000);

    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expires_in: auth.expires_in,
        token_type: auth.token_type,
        scope: auth.scope
      })
    );
  }

  private validateStoredAuth(auth: any): auth is AcuityAuthResponse {
    return (
      typeof auth === 'object' &&
      typeof auth.access_token === 'string' &&
      typeof auth.refresh_token === 'string' &&
      typeof auth.expires_in === 'number' &&
      typeof auth.token_type === 'string' &&
      typeof auth.scope === 'string'
    );
  }

  clearAuthState(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.tokenExpiry = undefined;
    localStorage.removeItem(this.storageKey);
  }

  isAuthenticated(): boolean {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date());
  }
}
