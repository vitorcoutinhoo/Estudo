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

export interface ImportRow {
  line: number
  date: string
  time: string
  area: string
  title: string
  priority: Priority
  minutes: number
  done: boolean
  duplicate: boolean
}

export interface ImportResult {
  sheet: string
  rows: ImportRow[]
  errors: string[]
  imported: number
}
