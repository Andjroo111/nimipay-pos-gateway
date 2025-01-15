import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AcuityAuth } from '../../auth/AcuityAuth';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AcuityAuth', () => {
  let auth: AcuityAuth;
  const mockConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    scope: ['appointments', 'payments']
  };

  beforeEach(() => {
    auth = new AcuityAuth(mockConfig);
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize from stored auth data', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      await auth.initialize();
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should handle corrupted storage data', async () => {
      localStorage.setItem('nimipay_acuity_auth', 'invalid-json');
      await auth.initialize();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('nimipay_acuity_auth')).toBeNull();
    });

    it('should handle expired tokens in storage', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: -3600, // Expired token
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      await auth.initialize();
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('token refresh', () => {
    it('should refresh expired token', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: -3600, // Expired token
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      await auth.initialize();

      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });

      const token = await auth.getAccessToken();
      expect(token).toBe('new-access-token');
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should handle refresh token failure', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: -3600, // Expired token
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      await auth.initialize();

      mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(auth.getAccessToken()).rejects.toThrow('Failed to refresh access token');
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('nimipay_acuity_auth')).toBeNull();
    });
  });

  describe('authentication', () => {
    it('should handle auth callback with invalid response', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid code'));

      await expect(auth.handleAuthCallback('invalid-code')).rejects.toThrow('Failed to exchange authorization code');
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should handle successful auth callback', async () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockToken });

      await auth.handleAuthCallback('valid-code');
      expect(auth.isAuthenticated()).toBe(true);
      expect(localStorage.getItem('nimipay_acuity_auth')).toBeTruthy();
    });

    it('should handle logout', () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      auth.clearAuthState();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('nimipay_acuity_auth')).toBeNull();
    });

    it('should validate stored auth data', () => {
      const mockToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: mockConfig.scope.join(' ')
      };

      localStorage.setItem('nimipay_acuity_auth', JSON.stringify(mockToken));
      expect(auth.isAuthenticated()).toBe(false); // Not authenticated until initialized
      auth.initialize();
      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('auth URL generation', () => {
    it('should generate correct auth URL', () => {
      const authUrl = auth.getAuthUrl();
      expect(authUrl).toContain('acuityscheduling.com/oauth2/authorize');
      expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
      expect(authUrl).toContain(`scope=${mockConfig.scope.join('+')}`);
    });
  });
});
