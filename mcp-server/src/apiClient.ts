import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from './config';
import { generateAgentJwt, defaultAgentIdentity } from './auth';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = config.apiBaseUrl) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private getAuthHeaders(userRole?: string) {
    const identity = userRole ? { ...defaultAgentIdentity, role: userRole } : defaultAgentIdentity;
    const token = generateAgentJwt(identity);
    return {
      Authorization: `Bearer ${token}`
    };
  }

  async get(url: string, params?: any, options?: { userRole?: string; fallbackUrls?: string[] }) {
    const headers = this.getAuthHeaders(options?.userRole);
    const reqConfig: AxiosRequestConfig = { headers, params };

    try {
      const response = await this.client.get(url, reqConfig);
      return response.data;
    } catch (error: any) {
      // Try fallback URLs if provided and initial request returned 404
      if (error.response?.status === 404 && options?.fallbackUrls && options.fallbackUrls.length > 0) {
        for (const fallbackUrl of options.fallbackUrls) {
          try {
            const fallbackResponse = await this.client.get(fallbackUrl, reqConfig);
            return fallbackResponse.data;
          } catch {
            // Continue to next fallback
          }
        }
      }

      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message || 'Upstream API Error';
      return {
        error: true,
        statusCode: status,
        message,
        details: error.response?.data || null
      };
    }
  }

  async post(url: string, data?: any, options?: { userRole?: string; fallbackUrls?: string[] }) {
    const headers = this.getAuthHeaders(options?.userRole);
    const reqConfig: AxiosRequestConfig = { headers };

    try {
      const response = await this.client.post(url, data, reqConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404 && options?.fallbackUrls && options.fallbackUrls.length > 0) {
        for (const fallbackUrl of options.fallbackUrls) {
          try {
            const fallbackResponse = await this.client.post(fallbackUrl, data, reqConfig);
            return fallbackResponse.data;
          } catch {
            // Continue to next fallback
          }
        }
      }

      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message || 'Upstream API Error';
      return {
        error: true,
        statusCode: status,
        message,
        details: error.response?.data || null
      };
    }
  }

  async put(url: string, data?: any, options?: { userRole?: string }) {
    const headers = this.getAuthHeaders(options?.userRole);
    try {
      const response = await this.client.put(url, data, { headers });
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message || 'Upstream API Error';
      return {
        error: true,
        statusCode: status,
        message,
        details: error.response?.data || null
      };
    }
  }
}

export const apiClient = new ApiClient();
