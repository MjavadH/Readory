import { apiClient } from '@/lib/api-client';

export async function logout() {
  await apiClient.post('/auth/logout');
}
