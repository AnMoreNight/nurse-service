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

export interface UserCreateByAdmin {
  company_id: string;
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

export interface AssignCompanyAdmin {
  company_id: string;
  user_id: string;
}

export interface RemoveCompanyAdmin {
  user_id: string;
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
  getAll: (companyId?: string) => {
    const params = companyId ? `?company_id=${companyId}` : '';
    return apiClient.get<User[]>(`/users${params}`);
  },

  getById: (id: string) => apiClient.get<User>(`/users/${id}`),

  create: (data: UserCreate) => apiClient.post<User>('/users', data),

  invite: (data: UserInvite) => apiClient.post('/users/invite', data),

  update: (id: string, data: UserUpdate) => apiClient.patch(`/users/${id}`, data),

  updateSortOrders: (sortOrders: UserSortOrder[]) =>
    apiClient.put('/users/sort-order', sortOrders),

  delete: (id: string) => apiClient.delete(`/users/${id}`),

  // Admin-only endpoints
  createByAdmin: (data: UserCreateByAdmin) => apiClient.post<User>('/users/admin/create', data),

  assignCompanyAdmin: (data: AssignCompanyAdmin) =>
    apiClient.post('/users/admin/assign-company-admin', data),

  removeCompanyAdmin: (data: RemoveCompanyAdmin) =>
    apiClient.post('/users/admin/remove-company-admin', data),

  getCompanyAdmins: (companyId: string) =>
    apiClient.get<User[]>(`/users/admin/company-admins/${companyId}`),
};
