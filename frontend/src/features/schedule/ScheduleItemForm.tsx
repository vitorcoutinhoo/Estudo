import { useState } from 'react'
import { fmtMinutes, todayISO } from '../../shared/format'
import { FormModal } from '../../shared/ui/FormModal'
import { useSubmit } from '../../shared/useSubmit'
import { useTopics } from '../topics/TopicsContext'
import { sortTopics, TopicSelect } from '../topics/TopicSelect'
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
  const [topic, setTopic] = useState(item?.topicId ?? topicId ?? sortTopics(topics)[0]?.id ?? 0)
  const [day, setDay] = useState(item?.date ?? date ?? todayISO())
  const [start, setStart] = useState(item?.startTime ?? '')
  const [end, setEnd] = useState(item?.endTime ?? '')
  const [minutes, setMinutes] = useState(String(item?.plannedMinutes || 60))
  const [note, setNote] = useState(item?.note ?? '')
  const { saving, error, setError, run } = useSubmit()

  const hasTime = Boolean(start || end)
  const duration = minutesBetween(start, end)

  function submit() {
    if (hasTime && (!start || !end)) {
      setError('Informe início e fim, ou deixe os dois em branco.')
      return
    }
    const body = {
      topicId: topic,
      date: day,
      startTime: start,
      endTime: end,
      plannedMinutes: hasTime ? duration : Number(minutes) || 60,
      note,
      done: item?.done ?? false,
    }
    void run(async () => {
      if (item) await updateScheduleItem(item.id, body)
      else await createScheduleItem(body)
      await onSaved()
      onClose()
    })
  }

  return (
    <FormModal
      title={item ? 'Editar período de estudo' : 'Novo período de estudo'}
      onClose={onClose}
      onSubmit={submit}
      error={error}
      saving={saving}
      invalid={!topic}
    >
      <label>
        Tópico
        <TopicSelect value={topic} onChange={setTopic} disabled={topicId !== undefined} />
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
    </FormModal>
  )
}
