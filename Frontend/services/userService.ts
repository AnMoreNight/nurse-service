import { apiClient } from './apiClient';

export interface User {
  user_id: string;
  company_id?: string;
  email: string;
  role: string;
  name: string;
  profession?: string;
  job_title?: string;
  display_color?: string;
  avatar_url?: string;
  sort_order?: number;
  is_active: boolean;
  join_date?: string;
  left_date?: string;
  created_at: string;
}

export interface UserCreate {
  email: string;
  password: string;
  role: string;
  name: string;
  profession?: string;
  job_title?: string;
  display_color?: string;
  join_date?: string;
  left_date?: string;
}

export interface UserUpdate {
  name?: string;
  profession?: string;
  job_title?: string;
  display_color?: string;
  avatar_url?: string;
  role?: string;
  is_active?: boolean;
  join_date?: string;
  left_date?: string;
}

export interface UserInvite {
  email: string;
  role: string;
}

export interface UserSortOrder {
  user_id: string;
  sort_order: number;
}

export const userService = {
  getAll: () => apiClient.get<User[]>('/users'),

  getById: (id: string) => apiClient.get<User>(`/users/${id}`),

  create: (data: UserCreate) => apiClient.post<User>('/users', data),

  invite: (data: UserInvite) => apiClient.post('/users/invite', data),

  update: (id: string, data: UserUpdate) => apiClient.patch(`/users/${id}`, data),

  updateSortOrders: (sortOrders: UserSortOrder[]) =>
    apiClient.post('/users/sort-order', sortOrders),

  delete: (id: string) => apiClient.delete(`/users/${id}`),
};
