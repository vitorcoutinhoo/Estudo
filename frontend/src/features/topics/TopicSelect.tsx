import { useMemo } from 'react'
import { Select, type SelectOption } from '../../shared/ui/Select'
import { useTopics } from './TopicsContext'
import type { Topic } from './types'

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
const NO_AREA = 'Outros'

/** Tópicos em ordem alfabética, agrupados pela área (descrição); os sem área ficam no fim. */
export function sortTopics(topics: Topic[]): Topic[] {
  return [...topics].sort(
    (a, b) =>
      Number(!a.description) - Number(!b.description) ||
      collator.compare(a.description, b.description) ||
      collator.compare(a.title, b.title),
  )
}

interface Props {
  value: number
  onChange: (id: number) => void
  disabled?: boolean
  /** Inclui uma opção "todos" com valor 0 (para filtros). */
  allLabel?: string
  compact?: boolean
}

/** Select de tópico usado em todos os formulários e filtros. */
export function TopicSelect({ value, onChange, disabled, allLabel, compact }: Props) {
  const { topics } = useTopics()
  const options = useMemo(() => {
    const opts: SelectOption<number>[] = sortTopics(topics).map((t) => ({
      value: t.id,
      label: t.title,
      group: t.description || NO_AREA,
    }))
    // sem área nenhuma, os grupos só atrapalham
    if (topics.every((t) => !t.description)) opts.forEach((o) => delete o.group)
    return allLabel ? [{ value: 0, label: allLabel }, ...opts] : opts
  }, [topics, allLabel])

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      searchable={topics.length > 6}
      placeholder="Selecione um tópico"
      compact={compact}
      aria-label="Tópico"
    />
  )
}
