import { api } from '../../shared/api'

export interface Summary {
  totalMinutes: number
  todayMinutes: number
  todayPlanned: number
  todayItems: number
  todayItemsDone: number
  topics: number
  topicsDone: number
  topicsInProgress: number
  exercisesTotal: number
  exercisesSolved: number
  last7Days: { date: string; minutes: number }[]
}

export const getSummary = (today: string) => api<Summary>(`/api/dashboard?today=${today}`)
