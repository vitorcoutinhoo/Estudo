import { useCallback, useEffect, useState } from 'react'
import { fromISO } from '../../shared/format'
import { Modal } from '../../shared/ui/Modal'
import type { Topic } from '../topics/types'
import { deleteScheduleItem, fmtPeriod, listTopicSchedule, type ScheduleItem } from './api'
import { ScheduleItemForm } from './ScheduleItemForm'

interface Props {
  topic: Topic
  onClose: () => void
}

/** Períodos de estudo (itens do cronograma) de um tópico, com inclusão, edição e remoção. */
export function PeriodsModal({ topic, onClose }: Props) {
  const [items, setItems] = useState<ScheduleItem[] | null>(null)
  const [editing, setEditing] = useState<ScheduleItem | 'new' | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await listTopicSchedule(topic.id))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar períodos')
    }
  }, [topic.id])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(i: ScheduleItem) {
    if (!confirm(`Remover o período de ${fromISO(i.date).toLocaleDateString('pt-BR')} do cronograma?`)) return
    await deleteScheduleItem(i.id)
    await load()
  }

  if (editing) {
    return (
      <ScheduleItemForm
        item={editing === 'new' ? undefined : editing}
        topicId={topic.id}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    )
  }

  return (
    <Modal title={`Períodos de "${topic.title}"`} onClose={onClose} wide>
      <div className="form">
        {error && <p className="form-error">{error}</p>}
        {!items && !error && <p className="muted">Carregando…</p>}
        {items?.length === 0 && <div className="empty">Este tópico ainda não está no cronograma.</div>}
        <ul className="log-list">
          {items?.map((i) => (
            <li key={i.id}>
              <div>
                <strong style={{ textTransform: 'capitalize' }}>
                  {fromISO(i.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </strong>
                <span className="muted"> · {fmtPeriod(i)}{i.note ? ` · ${i.note}` : ''}{i.done ? ' · concluído' : ''}</span>
              </div>
              <button className="btn btn-small" onClick={() => setEditing(i)}>Editar</button>
              <button className="icon-btn" onClick={() => remove(i)} aria-label="Remover período">×</button>
            </li>
          ))}
        </ul>
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>+ Novo período</button>
        </footer>
      </div>
    </Modal>
  )
}
