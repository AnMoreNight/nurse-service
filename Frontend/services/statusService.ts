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

export interface StatusItem {
  status_id?: string;  // undefined for new statuses
  name: string;
  color: string;
  sort_order?: number;
}

export interface StatusBulkUpdate {
  statuses: StatusItem[];
}

export const statusService = {
  getAll: (companyId?: string) => {
    const params = companyId ? `?company_id=${companyId}` : '';
    return apiClient.get<ScheduleStatus[]>(`/statuses${params}`);
  },

  create: (data: ScheduleStatusCreate) => apiClient.post<ScheduleStatus>('/statuses', data),

  update: (id: string, data: ScheduleStatusUpdate) =>
    apiClient.patch(`/statuses/${id}`, data),

  delete: (id: string) => apiClient.delete(`/statuses/${id}`),

  bulkUpdate: (data: StatusBulkUpdate) =>
    apiClient.patch<ScheduleStatus[]>('/statuses/bulk/update', data),
};
