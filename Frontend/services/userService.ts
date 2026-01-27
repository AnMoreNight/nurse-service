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
  default_holiday_weekdays?: number[];
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
  default_holiday_weekdays?: number[];
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
  default_holiday_weekdays?: number[];
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
  default_holiday_weekdays?: number[]; // Array of weekday indices (0=Sun, 1=Mon, etc.)
}

export interface UserInvite {
  email: string;
  role: string;
}

export interface UserSortOrder {
  user_id: string;
  sort_order: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const userService = {
  getAll: (companyId?: string) => {
    const params = companyId ? `?company_id=${companyId}` : '';
    return apiClient.get<User[]>(`/users${params}`);
  },

  // Get all users including admins with optional pagination - used by admin pages
  getAllUsers: (
    companyId?: string,
    page?: number,
    pageSize?: number,
    noPagination: boolean = false
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId);
    if (!noPagination && page !== undefined) params.append('page', page.toString());
    if (!noPagination && pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (noPagination) params.append('no_pagination', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<User[] | PaginatedResponse<User>>(`/users/all-users${query}`);
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
