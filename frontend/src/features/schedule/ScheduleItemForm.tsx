import { useState, type FormEvent } from 'react'
import { fmtMinutes, todayISO } from '../../shared/format'
import { Modal } from '../../shared/ui/Modal'
import { useTopics } from '../topics/TopicsContext'
import { createScheduleItem, updateScheduleItem, type ScheduleItem } from './api'

interface Props {
  /** Item existente: edita em vez de criar. */
  item?: ScheduleItem
  /** Fixa o tópico (ex.: aberto a partir do card do tópico). */
  topicId?: number
  date?: string
  onClose: () => void
  onSaved: () => void | Promise<void>
}

function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const d = eh * 60 + em - (sh * 60 + sm)
  return d <= 0 ? d + 24 * 60 : d
}

/** Cria ou edita um período de estudo (item do cronograma): tópico, data e horário. */
export function ScheduleItemForm({ item, topicId, date, onClose, onSaved }: Props) {
  const { topics } = useTopics()
  const [topic, setTopic] = useState(item?.topicId ?? topicId ?? topics[0]?.id ?? 0)
  const [day, setDay] = useState(item?.date ?? date ?? todayISO())
  const [start, setStart] = useState(item?.startTime ?? '')
  const [end, setEnd] = useState(item?.endTime ?? '')
  const [minutes, setMinutes] = useState(String(item?.plannedMinutes || 60))
  const [note, setNote] = useState(item?.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const hasTime = Boolean(start || end)
  const duration = minutesBetween(start, end)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (hasTime && (!start || !end)) {
      setError('Informe início e fim, ou deixe os dois em branco.')
      return
    }
    setSaving(true)
    const body = {
      topicId: topic,
      date: day,
      startTime: start,
      endTime: end,
      plannedMinutes: hasTime ? duration : Number(minutes) || 60,
      note,
      done: item?.done ?? false,
    }
    try {
      if (item) await updateScheduleItem(item.id, body)
      else await createScheduleItem(body)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <Modal title={item ? 'Editar período de estudo' : 'Novo período de estudo'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Tópico
          <select value={topic} onChange={(e) => setTopic(Number(e.target.value))} disabled={topicId !== undefined}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.description ? `${t.description} · ` : ''}{t.title}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Data
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
          </label>
          <label>
            Início
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Fim
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {hasTime ? (
          <p className="muted">Duração: <b>{duration > 0 && start && end ? fmtMinutes(duration) : '—'}</b></p>
        ) : (
          <label>
            Minutos planejados (sem horário definido)
            <input type="number" min="1" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        )}
        <label>
          Nota (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: focar nos exercícios 3 a 5" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !topic}>Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}
