import { api, BASE } from '../../shared/api'

export interface Exercise {
  id: number
  topicId: number
  topicTitle: string
  title: string
  statement: string
  solution: string
  solved: boolean
  pdfName: string
  pdfSize: number
}

export type ExerciseInput = Pick<Exercise, 'topicId' | 'title' | 'statement' | 'solution' | 'solved'>

export const listExercises = (topicId?: number) =>
  api<Exercise[]>(`/api/exercises${topicId ? `?topicId=${topicId}` : ''}`)
export const createExercise = (body: ExerciseInput) => api<Exercise>('/api/exercises', { method: 'POST', body })
export const updateExercise = (id: number, body: ExerciseInput) =>
  api<Exercise>(`/api/exercises/${id}`, { method: 'PUT', body })
export const deleteExercise = (id: number) => api<void>(`/api/exercises/${id}`, { method: 'DELETE' })

export const exercisePdfURL = (id: number) => `${BASE}/api/exercises/${id}/pdf`
export const uploadExercisePdf = (id: number, file: File) => {
  const body = new FormData()
  body.append('file', file)
  return api<Exercise>(`/api/exercises/${id}/pdf`, { method: 'PUT', body })
}
export const deleteExercisePdf = (id: number) => api<void>(`/api/exercises/${id}/pdf`, { method: 'DELETE' })
