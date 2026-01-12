const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - auto logout
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          window.location.href = '/login';
        }
      }

      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      
      // Handle error detail properly - it might be a string or an object
      let errorMessage: string;
      if (typeof error.detail === 'string') {
        errorMessage = error.detail;
      } else if (typeof error.detail === 'object' && error.detail !== null) {
        errorMessage = JSON.stringify(error.detail);
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `HTTP ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
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
