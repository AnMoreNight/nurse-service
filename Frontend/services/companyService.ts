import { apiClient } from './apiClient';

export interface Company {
  company_id: string;
  name: string;
  is_active: boolean;
  user_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CompanyCreate {
  name: string;
}

export interface CompanyUpdate {
  name?: string;
  is_active?: boolean;
}

export const companyService = {
  getAll: () => apiClient.get<Company[]>('/companies'),

  getById: (id: string) => apiClient.get<Company>(`/companies/${id}`),

  create: (data: CompanyCreate) => apiClient.post<Company>('/companies', data),

  update: (id: string, data: CompanyUpdate) => apiClient.patch<Company>(`/companies/${id}`, data),

  delete: (id: string) => apiClient.delete(`/companies/${id}`),

  // Company Settings
  getAllSettings: (companyId: string) => apiClient.get<Record<string, any>>(`/companies/${companyId}/settings`),

  getSetting: (companyId: string, key: string) => apiClient.get<{ key: string; value: any }>(`/companies/${companyId}/settings/${key}`),

  upsertSetting: (companyId: string, key: string, value: any) => apiClient.put(`/companies/${companyId}/settings/${key}`, value),

  deleteSetting: (companyId: string, key: string) => apiClient.delete(`/companies/${companyId}/settings/${key}`),
};
