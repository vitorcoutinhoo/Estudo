import { useState, type FormEvent } from 'react'
import { Modal } from '../../shared/ui/Modal'
import { useTopics } from '../topics/TopicsContext'
import { createExercise, updateExercise, type Exercise } from './api'

interface Props {
  exercise?: Exercise
  defaultTopicId?: number
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function ExerciseForm({ exercise, defaultTopicId, onClose, onSaved }: Props) {
  const { topics } = useTopics()
  const [topicId, setTopicId] = useState(exercise?.topicId ?? defaultTopicId ?? topics[0]?.id ?? 0)
  const [title, setTitle] = useState(exercise?.title ?? '')
  const [statement, setStatement] = useState(exercise?.statement ?? '')
  const [solution, setSolution] = useState(exercise?.solution ?? '')
  const [solved, setSolved] = useState(exercise?.solved ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = { topicId, title, statement, solution, solved }
    try {
      if (exercise) await updateExercise(exercise.id, body)
      else await createExercise(body)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <Modal title={exercise ? 'Editar exercício' : 'Novo exercício'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-row form-row-2">
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Lista 3 · questão 7" autoFocus required />
          </label>
          <label>
            Tópico
            <select value={topicId} onChange={(e) => setTopicId(Number(e.target.value))}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        </div>
        <label>
          Enunciado
          <textarea className="mono" value={statement} onChange={(e) => setStatement(e.target.value)} rows={5} placeholder="Cole o enunciado ou um link" />
        </label>
        <label>
          Resolução / anotações
          <textarea className="mono" value={solution} onChange={(e) => setSolution(e.target.value)} rows={7} placeholder="Sua solução, código ou o que aprendeu" />
        </label>
        <label className="check">
          <input type="checkbox" checked={solved} onChange={(e) => setSolved(e.target.checked)} />
          Já resolvi este exercício
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !topicId}>Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}
