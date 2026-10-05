import { api } from '../../shared/api'
import type { Priority } from '../topics/types'

export interface ScheduleItem {
  id: number
  topicId: number
  topicTitle: string
  topicPriority: Priority
  date: string
  plannedMinutes: number
  done: boolean
  note: string
}

export const listSchedule = (from: string, to: string) =>
  api<ScheduleItem[]>(`/api/schedule?from=${from}&to=${to}`)

export const createScheduleItem = (body: { topicId: number; date: string; plannedMinutes: number; note: string }) =>
  api<ScheduleItem>('/api/schedule', { method: 'POST', body })

export const patchScheduleItem = (id: number, body: Partial<Pick<ScheduleItem, 'done' | 'plannedMinutes' | 'date' | 'note'>>) =>
  api<ScheduleItem>(`/api/schedule/${id}`, { method: 'PATCH', body })

export const deleteScheduleItem = (id: number) => api<void>(`/api/schedule/${id}`, { method: 'DELETE' })
