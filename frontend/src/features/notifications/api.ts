import { api } from '@/lib/axios';

export interface NotificationItem {
  id: string;
  eventKey: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export const notificationsApi = {
  list: (page = 1, pageSize = 20) => api.get<NotificationPage>('/notifications', { params: { page, pageSize } }).then((r) => r.data),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
