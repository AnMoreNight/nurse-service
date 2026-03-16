import { apiClient } from './apiClient';
import { User } from './userService';

export interface RecurringRule {
  frequency: string;
  day_of_week?: number[];
  week_of_month?: number[];  // Array to support multiple weeks (e.g., [1, 3] for 1st and 3rd week)
  day_of_week_monthly?: number;
  month_of_year?: number;
  day_of_month?: number;
  interval: number;
  start_date: string;
  end_date?: string;
}

export interface Schedule {
  schedule_id: string;
  company_id: string;
  patient_id?: string;
  patient_name: string;
  visit_address?: string;
  start_time: string;
  end_time: string;
  status_id: string;
  memo?: string;
  recurring_rule_id?: string;
  recurring_rule?: RecurringRule;
  recurring_series_id?: string;
  is_exception: boolean;
  assigned_users: User[];
  created_at: string;
}

export interface ScheduleCreate {
  company_id?: string;
  patient_id?: string;
  patient_name: string;
  visit_address?: string;
  start_time: string;
  end_time: string;
  status_id: string;
  memo?: string;
  assigned_user_ids: string[];
  recurring_rule?: RecurringRule;
}

export interface ScheduleUpdate {
  company_id?: string;
  patient_name?: string;
  visit_address?: string;
  start_time?: string;
  end_time?: string;
  status_id?: string;
  memo?: string;
  assigned_user_ids?: string[];
  recurring_rule?: RecurringRule;
  update_scope?: 'this' | 'future' | 'all';
}

export const scheduleService = {
  getAll: (startDate?: string, endDate?: string, patientName?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (patientName) params.append('patient_name', patientName);
    if (companyId) params.append('company_id', companyId);
    const query = params.toString();
    return apiClient.get<Schedule[]>(`/schedules${query ? `?${query}` : ''}`);
  },
  
  create: (data: ScheduleCreate) => apiClient.post<Schedule>('/schedules', data),
  
  update: (id: string, data: ScheduleUpdate) => 
    apiClient.patch(`/schedules/${id}`, data),
  
  delete: (id: string, scope?: string, occurrenceDate?: string) => {
    const params = new URLSearchParams();
    if (scope) params.append('scope', scope);
    if (occurrenceDate) params.append('occurrence_date', occurrenceDate);
    const query = params.toString();
    return apiClient.delete(`/schedules/${id}${query ? `?${query}` : ''}`);
  },
  
  copy: (id: string) => 
    apiClient.get<{ patient_name: string; visit_address?: string }>(`/schedules/${id}/copy`),
  
  exportCSV: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return apiClient.downloadCSV(`/schedules/export/csv?${params.toString()}`);
  },

  cleanupDuplicates: () => apiClient.post<{ deleted_count: number; kept_count: number }>('/schedules/cleanup-duplicates', {}),

  bulkSpecialInstruction: (data: {
    company_id?: string;
    patient_name: string;
    visit_address?: string;
    start_date: string;
    start_time: string;
    end_time: string;
    status_id: string;
    memo?: string;
    assigned_user_ids: string[];
    days?: number;
  }) => apiClient.post<{ created_count: number; schedule_ids: string[]; start_date: string; end_date: string }>('/schedules/bulk-special-instruction', data),

  bulkRecurring: (data: {
    company_id?: string;
    patient_name: string;
    visit_address?: string;
    start_date: string;
    start_time: string;
    end_time: string;
    day_of_week: number[];
    status_id: string;
    memo?: string;
    assigned_user_ids: string[];
  }) => apiClient.post<{
    created_count: number;
    items: { schedule_id: string; recurring_series_id: string; day_of_week: number }[];
    schedule_id: string;
    recurring_series_id: string;
  }>('/schedules/bulk-recurring', data),
};
