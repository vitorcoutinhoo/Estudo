import { useState } from 'react'
import { todayISO } from '../../shared/format'
import { FormModal } from '../../shared/ui/FormModal'
import { useSubmit } from '../../shared/useSubmit'
import { useTopics } from '../topics/TopicsContext'
import { sortTopics, TopicSelect } from '../topics/TopicSelect'
import { createSession, updateSession, type Session } from './api'

interface Props {
  /** Registro existente: o formulário passa a editar em vez de criar. */
  session?: Session
  topicId?: number
  date?: string
  minutes?: number
  onClose: () => void
  onSaved: () => void | Promise<void>
}

const QUICK = [15, 30, 45, 60, 90, 120]

/** Registra (ou edita) horas estudadas em um tópico. */
export function SessionForm({ session, topicId, date, minutes, onClose, onSaved }: Props) {
  const { topics, reload } = useTopics()
  const [topic, setTopic] = useState(session?.topicId ?? topicId ?? sortTopics(topics)[0]?.id ?? 0)
  const [day, setDay] = useState(session?.date ?? date ?? todayISO())
  const [mins, setMins] = useState(String(session?.minutes ?? minutes ?? 60))
  const [note, setNote] = useState(session?.note ?? '')
  const { saving, error, run } = useSubmit()

  const submit = () =>
    run(async () => {
      const body = { topicId: topic, date: day, minutes: Number(mins), note }
      if (session) await updateSession(session.id, body)
      else await createSession(body)
      await reload()
      await onSaved()
      onClose()
    })

  return (
    <FormModal
      title={session ? 'Editar registro de horas' : 'Registrar horas estudadas'}
      onClose={onClose}
      onSubmit={submit}
      error={error}
      saving={saving}
      invalid={!topic}
      submitLabel={session ? 'Salvar' : 'Registrar'}
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
          Minutos
          <input type="number" min="1" step="1" value={mins} onChange={(e) => setMins(e.target.value)} required />
        </label>
      </div>
      <div className="chips">
        {QUICK.map((q) => (
          <button type="button" key={q} className={`chip ${Number(mins) === q ? 'is-active' : ''}`} onClick={() => setMins(String(q))}>
            {q >= 60 ? `${q / 60}h` : `${q}min`}
          </button>
        ))}
      </div>
      <label>
        Anotação (opcional)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que você estudou?" />
      </label>
    </FormModal>
  )
}
