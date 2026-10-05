import { api } from '../../shared/api'

export interface Session {
  id: number
  topicId: number
  topicTitle: string
  date: string
  minutes: number
  note: string
}

export interface SessionInput {
  topicId: number
  date: string
  minutes: number
  note: string
}

export const listSessions = (topicId?: number) =>
  api<Session[]>(`/api/sessions${topicId ? `?topicId=${topicId}` : ''}`)
export const createSession = (body: SessionInput) => api<Session>('/api/sessions', { method: 'POST', body })
export const deleteSession = (id: number) => api<void>(`/api/sessions/${id}`, { method: 'DELETE' })
