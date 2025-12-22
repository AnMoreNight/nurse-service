import { apiClient } from './apiClient';

export interface ScheduleStatus {
  status_id: string;
  company_id: string;
  name: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  sort_order?: number;
  created_at: string;
}

export interface ScheduleStatusCreate {
  name: string;
  color: string;
}

export interface ScheduleStatusUpdate {
  name?: string;
  color?: string;
  is_active?: boolean;
  sort_order?: number;
}

export const statusService = {
  getAll: () => apiClient.get<ScheduleStatus[]>('/statuses'),
  
  create: (data: ScheduleStatusCreate) => apiClient.post<ScheduleStatus>('/statuses', data),
  
  update: (id: string, data: ScheduleStatusUpdate) => 
    apiClient.patch(`/statuses/${id}`, data),
  
  delete: (id: string) => apiClient.delete(`/statuses/${id}`),
};
