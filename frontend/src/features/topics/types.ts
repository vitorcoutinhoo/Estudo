export type Priority = 'low' | 'medium' | 'high'
export type Status = 'todo' | 'in_progress' | 'done'

export interface Topic {
  id: number
  title: string
  description: string
  priority: Priority
  status: Status
  targetMinutes: number
  studiedMinutes: number
  progress: number
  exercisesTotal: number
  exercisesSolved: number
}

export type TopicInput = Pick<Topic, 'title' | 'description' | 'priority' | 'status' | 'targetMinutes'>
