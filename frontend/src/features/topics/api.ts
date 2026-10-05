import { api } from '../../shared/api'
import type { Topic, TopicInput } from './types'

export const listTopics = () => api<Topic[]>('/api/topics')
export const createTopic = (body: TopicInput) => api<Topic>('/api/topics', { method: 'POST', body })
export const updateTopic = (id: number, body: TopicInput) => api<Topic>(`/api/topics/${id}`, { method: 'PUT', body })
export const deleteTopic = (id: number) => api<void>(`/api/topics/${id}`, { method: 'DELETE' })
