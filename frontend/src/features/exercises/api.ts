import { api } from '../../shared/api'

export interface Exercise {
  id: number
  topicId: number
  topicTitle: string
  title: string
  statement: string
  solution: string
  solved: boolean
}

export type ExerciseInput = Pick<Exercise, 'topicId' | 'title' | 'statement' | 'solution' | 'solved'>

export const listExercises = (topicId?: number) =>
  api<Exercise[]>(`/api/exercises${topicId ? `?topicId=${topicId}` : ''}`)
export const createExercise = (body: ExerciseInput) => api<Exercise>('/api/exercises', { method: 'POST', body })
export const updateExercise = (id: number, body: ExerciseInput) =>
  api<Exercise>(`/api/exercises/${id}`, { method: 'PUT', body })
export const deleteExercise = (id: number) => api<void>(`/api/exercises/${id}`, { method: 'DELETE' })
