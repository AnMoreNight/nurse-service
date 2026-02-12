const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));

      // Handle 401 Unauthorized - auto logout (but not for login requests)
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          window.location.href = '/login';
        }
      }

      // Handle 403 Forbidden - check if account not properly configured
      if (response.status === 403) {
        const errorDetail = typeof error.detail === 'string' ? error.detail : '';
        // If user account is misconfigured, force logout and show message
        if (errorDetail.includes('not properly configured') || errorDetail.includes('assign you to a company')) {
          if (typeof window !== 'undefined') {
            // Use global modal if available, fallback to alert
            if (window.showModalAlert) {
              await window.showModalAlert('アカウントが更新されました。再度ログインしてください。', 'warning');
            } else {
              // Fallback for cases where modal system isn't loaded yet
              console.warn('Modal system not available, redirecting to login');
            }
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            window.location.href = '/login';
          }
          throw error;
        }
      }

      // Handle error detail properly - extract only the message
      let errorMessage: string;
      if (typeof error.detail === 'string') {
        errorMessage = error.detail;
      } else if (Array.isArray(error.detail)) {
        // Handle Pydantic validation errors (array of error objects)
        errorMessage = error.detail.map((err: any) => err.msg || err.message).join(', ') || 'エラーが発生しました';
      } else if (typeof error.detail === 'object' && error.detail !== null) {
        // Extract message from error object
        errorMessage = error.detail.message || error.detail.msg || 'エラーが発生しました';
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `HTTP ${response.status}`;
      }

      throw new Error(errorMessage);
      }

      return response.json();
    } catch (error: any) {
      // Network error or fetch failed - retry once
      if (retryCount < 1 && (error.name === 'TypeError' || error.message?.includes('fetch'))) {
        console.log(`[ApiClient] Request failed, retrying... (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',  // Backend uses PUT, not PATCH
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async downloadCSV(endpoint: string): Promise<Blob> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }
}

export const apiClient = new ApiClient();
