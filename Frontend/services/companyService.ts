import { apiClient } from './apiClient';

export interface Company {
  company_id: string;
  name: string;
  created_at: string;
}

export interface CompanyCreate {
  name: string;
}

export const companyService = {
  getAll: () => apiClient.get<Company[]>('/companies'),
  
  getById: (id: string) => apiClient.get<Company>(`/companies/${id}`),
  
  create: (data: CompanyCreate) => apiClient.post<Company>('/companies', data),
  
  delete: (id: string) => apiClient.delete(`/companies/${id}`),
};
