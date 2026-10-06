import { api, BASE } from '../../shared/api'
import type { ImportResult, Topic, TopicInput } from './types'

export const listTopics = () => api<Topic[]>('/api/topics')
export const createTopic = (body: TopicInput) => api<Topic>('/api/topics', { method: 'POST', body })
export const updateTopic = (id: number, body: TopicInput) => api<Topic>(`/api/topics/${id}`, { method: 'PUT', body })
export const deleteTopic = (id: number) => api<void>(`/api/topics/${id}`, { method: 'DELETE' })

export const importTopics = (file: File, dryRun: boolean) => {
  const body = new FormData()
  body.append('file', file)
  return api<ImportResult>(`/api/topics/import${dryRun ? '?dryRun=1' : ''}`, { method: 'POST', body })
}
export const importTemplateURL = `${BASE}/api/topics/import/template`
