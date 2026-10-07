import { api } from '../../shared/api'
import { fmtMinutes } from '../../shared/format'
import type { Priority } from '../topics/types'

export interface ScheduleItem {
  id: number
  topicId: number
  topicTitle: string
  topicPriority: Priority
  date: string
  /** "HH:MM", ou "" quando o período não tem horário definido */
  startTime: string
  endTime: string
  plannedMinutes: number
  done: boolean
  note: string
}

export const listSchedule = (from: string, to: string) =>
  api<ScheduleItem[]>(`/api/schedule?from=${from}&to=${to}`)

export const listTopicSchedule = (topicId: number) => api<ScheduleItem[]>(`/api/schedule?topicId=${topicId}`)

export type ScheduleInput = Pick<ScheduleItem, 'topicId' | 'date' | 'startTime' | 'endTime' | 'plannedMinutes' | 'note' | 'done'>

export const createScheduleItem = (body: ScheduleInput) => api<ScheduleItem>('/api/schedule', { method: 'POST', body })

export const updateScheduleItem = (id: number, body: ScheduleInput) =>
  api<ScheduleItem>(`/api/schedule/${id}`, { method: 'PUT', body })

/** "19h–22h" / "19h30–22h" (mesmo formato da planilha); "" quando não há horário. */
export function fmtTimeRange(i: Pick<ScheduleItem, 'startTime' | 'endTime'>): string {
  if (!i.startTime) return ''
  const h = (t: string) => {
    const [hh, mm] = t.split(':')
    return `${Number(hh)}h${mm === '00' ? '' : mm}`
  }
  return `${h(i.startTime)}–${h(i.endTime)}`
}

/** "19:00–22:00 · 3h" quando há horário; senão só a duração planejada. */
export function fmtPeriod(i: Pick<ScheduleItem, 'startTime' | 'endTime' | 'plannedMinutes'>): string {
  const dur = i.plannedMinutes > 0 ? fmtMinutes(i.plannedMinutes) : ''
  if (!i.startTime) return dur || 'sem horário'
  return `${i.startTime}–${i.endTime}${dur ? ` · ${dur}` : ''}`
}

export const patchScheduleItem = (id: number, body: Partial<Pick<ScheduleItem, 'done' | 'plannedMinutes' | 'date' | 'note'>>) =>
  api<ScheduleItem>(`/api/schedule/${id}`, { method: 'PATCH', body })

export const deleteScheduleItem = (id: number) => api<void>(`/api/schedule/${id}`, { method: 'DELETE' })
