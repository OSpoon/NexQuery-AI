import api from '@/lib/api'

export interface PromptItem {
  key: string
  content: string
  description?: string
  source: 'database' | 'file'
  updatedAt?: string
}

export const promptsApi = {
  // Get all prompts
  getAll: () => api.get<PromptItem[]>('/admin/prompts'),

  // Get a single prompt
  get: (key: string) => api.get<PromptItem>(`/admin/prompts/${encodeURIComponent(key)}`),

  // Update a prompt (Save to DB)
  update: (key: string, data: { content: string, description?: string }) =>
    api.put<{ message: string, data: PromptItem }>(
      `/admin/prompts/${encodeURIComponent(key)}`,
      data,
    ),

  // Reset a prompt (Delete from DB)
  reset: (key: string) =>
    api.delete<{ message: string, existsInFile: boolean }>(
      `/admin/prompts/${encodeURIComponent(key)}`,
    ),
}
