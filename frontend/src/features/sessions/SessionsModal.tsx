import { useState } from 'react'
import { useCached } from '../../shared/cache'
import { fmtMinutes, fromISO } from '../../shared/format'
import { Modal } from '../../shared/ui/Modal'
import { useTopics } from '../topics/TopicsContext'
import type { Topic } from '../topics/types'
import { deleteSession, listSessions, type Session } from './api'
import { SessionForm } from './SessionForm'

interface Props {
  topic: Topic
  onClose: () => void
}

/** Horas registradas em um tópico, com edição e remoção de cada registro. */
export function SessionsModal({ topic, onClose }: Props) {
  const { reload } = useTopics()
  const { data: sessions, error, reload: load } = useCached(`sessions:${topic.id}`, () => listSessions(topic.id))
  const [editing, setEditing] = useState<Session | 'new' | null>(null)

  async function remove(s: Session) {
    if (!confirm(`Remover o registro de ${fmtMinutes(s.minutes)}?`)) return
    await deleteSession(s.id)
    await Promise.all([load(), reload()])
  }

  if (editing) {
    return (
      <SessionForm
        session={editing === 'new' ? undefined : editing}
        topicId={topic.id}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    )
  }

  const total = sessions?.reduce((sum, s) => sum + s.minutes, 0) ?? 0

  return (
    <Modal title={`Horas de "${topic.title}"`} onClose={onClose} wide>
      <div className="form">
        <p className="muted">
          Total: <b>{fmtMinutes(total)}</b>
          {topic.targetMinutes > 0 && <> de {fmtMinutes(topic.targetMinutes)} da meta</>}
        </p>
        {error && <p className="form-error">{error}</p>}
        {!sessions && !error && <p className="muted">Carregando…</p>}
        {sessions?.length === 0 && <div className="empty">Nenhuma hora registrada neste tópico.</div>}
        <ul className="log-list">
          {sessions?.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{fromISO(s.date).toLocaleDateString('pt-BR')}</strong>
                {s.note && <span className="muted"> · {s.note}</span>}
              </div>
              <span className="schedule-time">{fmtMinutes(s.minutes)}</span>
              <button className="btn btn-small" onClick={() => setEditing(s)}>Editar</button>
              <button className="icon-btn" onClick={() => remove(s)} aria-label="Remover registro">×</button>
            </li>
          ))}
        </ul>
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>+ Registrar horas</button>
        </footer>
      </div>
    </Modal>
  )
}
