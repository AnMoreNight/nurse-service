import { apiClient } from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    user_id: string;
    email: string;
    role: string;
    name: string;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface InvitationAccept {
  token: string;
  password: string;
  name: string;
}

export const authService = {
  login: (data: LoginRequest) => 
    apiClient.post<LoginResponse>('/auth/login', data),

  requestPasswordReset: (data: PasswordResetRequest) =>
    apiClient.post('/auth/password-reset/request', data),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/password-reset/confirm', { token, new_password: newPassword }),

  acceptInvitation: (data: InvitationAccept) =>
    apiClient.post('/auth/invitation/accept', data),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  getStoredUser: () => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  storeAuth: (token: string, user: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
  },
};
