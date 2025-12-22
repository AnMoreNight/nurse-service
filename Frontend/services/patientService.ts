import { apiClient } from './apiClient';

export interface Patient {
  patient_id: string;
  company_id: string;
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface PatientCreate {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface PatientUpdate {
  name?: string;
  address?: string;
  phone?: string;
  notes?: string;
  is_active?: boolean;
}

export const patientService = {
  getAll: (search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.get<Patient[]>(`/patients${params}`);
  },
  
  getById: (id: string) => apiClient.get<Patient>(`/patients/${id}`),
  
  create: (data: PatientCreate) => apiClient.post<Patient>('/patients', data),
  
  update: (id: string, data: PatientUpdate) => apiClient.patch(`/patients/${id}`, data),
  
  delete: (id: string) => apiClient.delete(`/patients/${id}`),
};
