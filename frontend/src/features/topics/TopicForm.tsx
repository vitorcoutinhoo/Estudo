import { useState, type FormEvent } from 'react'
import { Modal } from '../../shared/ui/Modal'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../shared/ui/Tags'
import { createTopic, updateTopic } from './api'
import type { Priority, Status, Topic } from './types'

interface Props {
  topic?: Topic
  onClose: () => void
  onSaved: () => void
}

export function TopicForm({ topic, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(topic?.title ?? '')
  const [description, setDescription] = useState(topic?.description ?? '')
  const [priority, setPriority] = useState<Priority>(topic?.priority ?? 'medium')
  const [status, setStatus] = useState<Status>(topic?.status ?? 'todo')
  const [targetHours, setTargetHours] = useState(String((topic?.targetMinutes ?? 600) / 60))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      title,
      description,
      priority,
      status,
      targetMinutes: Math.round((Number(targetHours) || 0) * 60),
    }
    try {
      if (topic) await updateTopic(topic.id, body)
      else await createTopic(body)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <Modal title={topic ? 'Editar tópico' : 'Novo tópico'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estruturas de dados" autoFocus required />
        </label>
        <label>
          Descrição
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="O que será estudado neste tópico" />
        </label>
        <div className="form-row">
          <label>
            Prioridade
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {Number(targetHours) > 0 && (
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          <label>
            Meta (horas)
            <input type="number" min="0" step="0.5" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} />
          </label>
        </div>
        {!(Number(targetHours) > 0) && (
          <p className="muted">Sem meta: tópico avulso (ex.: revisões pontuais). Acumula horas e exercícios, mas não tem status nem progresso.</p>
        )}
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}
