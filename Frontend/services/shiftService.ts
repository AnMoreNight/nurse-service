import { apiClient } from './apiClient';

export interface Shift {
  shift_id: string;
  company_id: string;
  user_id: string;
  shift_date: string;
  shift_type: string;
  is_auto_reflected: boolean;
  memo?: string;
  created_at: string;
}

export interface ShiftCreate {
  user_id: string;
  shift_date: string;
  shift_type: string;
}

export interface ShiftUpdate {
  shift_type: string;
}

export interface WeeklyOffRule {
  rule_id: string;
  company_id: string;
  user_id: string;
  day_of_week: string;
  shift_type: string;
  is_active: boolean;
  created_at: string;
}

export interface WeeklyOffRuleCreate {
  user_id: string;
  day_of_week: string;
  shift_type: string;
}

export const shiftService = {
  getAll: (userId?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    return apiClient.get<Shift[]>(`/shifts${query ? `?${query}` : ''}`);
  },
  
  create: (data: ShiftCreate) => apiClient.post<Shift>('/shifts', data),
  
  update: (id: string, data: ShiftUpdate) => apiClient.patch(`/shifts/${id}`, data),
  
  delete: (id: string) => apiClient.delete(`/shifts/${id}`),
  
  getWeeklyOffRules: (userId?: string) => {
    const params = userId ? `?user_id=${userId}` : '';
    return apiClient.get<WeeklyOffRule[]>(`/shifts/weekly-off-rules${params}`);
  },
  
  createWeeklyOffRule: (data: WeeklyOffRuleCreate) => 
    apiClient.post('/shifts/weekly-off-rules', data),
  
  applyWeeklyRules: (startDate: string, endDate: string) =>
    apiClient.post(`/shifts/apply-weekly-rules?start_date=${startDate}&end_date=${endDate}`, {}),
  
  exportCSV: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return apiClient.downloadCSV(`/shifts/export/csv?${params.toString()}`);
  },
};
