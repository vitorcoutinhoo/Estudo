import { useState, type FormEvent } from 'react'
import { todayISO } from '../../shared/format'
import { Modal } from '../../shared/ui/Modal'
import { useTopics } from '../topics/TopicsContext'
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
  const [topic, setTopic] = useState(session?.topicId ?? topicId ?? topics[0]?.id ?? 0)
  const [day, setDay] = useState(session?.date ?? date ?? todayISO())
  const [mins, setMins] = useState(String(session?.minutes ?? minutes ?? 60))
  const [note, setNote] = useState(session?.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = { topicId: topic, date: day, minutes: Number(mins), note }
      if (session) await updateSession(session.id, body)
      else await createSession(body)
      await reload()
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <Modal title={session ? 'Editar registro de horas' : 'Registrar horas estudadas'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Tópico
          <select value={topic} onChange={(e) => setTopic(Number(e.target.value))} disabled={topicId !== undefined}>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
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
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !topic}>{session ? 'Salvar' : 'Registrar'}</button>
        </footer>
      </form>
    </Modal>
  )
}
