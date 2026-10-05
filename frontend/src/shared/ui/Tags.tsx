import type { Priority, Status } from '../../features/topics/types'

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }
export const STATUS_LABEL: Record<Status, string> = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluído',
}

export function PriorityTag({ value }: { value: Priority }) {
  return <span className={`tag tag-priority-${value}`}>{PRIORITY_LABEL[value]}</span>
}

export function StatusTag({ value }: { value: Status }) {
  return <span className={`tag tag-status-${value}`}>{STATUS_LABEL[value]}</span>
}

interface SelectProps<T extends string> {
  value: T
  options: Record<T, string>
  className: string
  label: string
  onChange: (v: T) => void
}

/** Tag que também é um <select>: permite trocar prioridade/status direto no cartão. */
export function TagSelect<T extends string>({ value, options, className, label, onChange }: SelectProps<T>) {
  return (
    <select
      className={`tag tag-select ${className}`}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {(Object.keys(options) as T[]).map((k) => (
        <option key={k} value={k}>{options[k]}</option>
      ))}
    </select>
  )
}
