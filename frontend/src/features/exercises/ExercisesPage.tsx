import { useState } from 'react'
import { useCached } from '../../shared/cache'
import { fmtBytes } from '../../shared/format'
import { useNav } from '../../shared/nav'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { Select } from '../../shared/ui/Select'
import { useTopics } from '../topics/TopicsContext'
import { TopicSelect } from '../topics/TopicSelect'
import { deleteExercise, exercisePdfURL, listExercises, updateExercise, type Exercise } from './api'
import { ExerciseForm } from './ExerciseForm'

type Situation = 'all' | 'solved' | 'pending'
const SITUATIONS = [
  { value: 'all' as Situation, label: 'Todos' },
  { value: 'pending' as Situation, label: 'Pendentes' },
  { value: 'solved' as Situation, label: 'Resolvidos' },
]

// carrega todos e filtra por tópico no cliente: trocar de tópico não faz nova requisição
export const exercisesQuery = ['exercises', () => listExercises()] as const

export function ExercisesPage() {
  const { topics, reload: reloadTopics } = useTopics()
  const nav = useNav()
  const [topicFilter, setTopicFilter] = useState(nav.topicId ?? 0)
  const [showSolved, setShowSolved] = useState<Situation>('all')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const { data, error, reload: load } = useCached(...exercisesQuery)
  const exercises = (data ?? []).filter((e) => !topicFilter || e.topicId === topicFilter)

  const refresh = async () => {
    await Promise.all([load(), reloadTopics()])
  }

  const solvedCount = exercises.filter((e) => e.solved).length
  const percent = exercises.length ? Math.round((solvedCount * 100) / exercises.length) : 0
  const visible = exercises.filter(
    (e) => showSolved === 'all' || (showSolved === 'solved' ? e.solved : !e.solved),
  )

  async function toggle(e: Exercise) {
    await updateExercise(e.id, { topicId: e.topicId, title: e.title, statement: e.statement, solution: e.solution, solved: !e.solved })
    await refresh()
  }

  async function remove(e: Exercise) {
    if (!confirm(`Remover o exercício "${e.title}"?`)) return
    await deleteExercise(e.id)
    await refresh()
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Exercícios</h1>
          <p className="muted">Guarde enunciados e resoluções e acompanhe o que já foi resolvido.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={topics.length === 0}>
          + Novo exercício
        </button>
      </header>

      <section className="card summary-bar">
        <div>
          <strong className="big">{solvedCount}</strong>
          <span className="muted"> de {exercises.length} resolvidos</span>
        </div>
        <ProgressBar value={percent} label="Exercícios resolvidos" />
        <strong className="percent">{percent}%</strong>
      </section>

      <div className="toolbar">
        <label className="inline-field">
          Tópico
          <TopicSelect value={topicFilter} onChange={setTopicFilter} allLabel="Todos" compact />
        </label>
        <label className="inline-field">
          Situação
          <Select value={showSolved} options={SITUATIONS} onChange={setShowSolved} compact aria-label="Situação" />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">Carregando…</p>}
      {data && visible.length === 0 && <div className="empty">Nenhum exercício por aqui ainda.</div>}

      <div className="exercise-list">
        {visible.map((e) => (
          <article key={e.id} className={`card exercise ${e.solved ? 'is-solved' : ''}`}>
            <div className="exercise-head">
              <input type="checkbox" checked={e.solved} onChange={() => toggle(e)} aria-label={`Marcar "${e.title}" como resolvido`} />
              <button className="exercise-title" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                <strong>{e.title}</strong>
                <span className="muted">{e.topicTitle}</span>
              </button>
              {e.pdfName && <span className="tag" title={e.pdfName}>PDF</span>}
              <span className={`tag ${e.solved ? 'tag-status-done' : 'tag-status-todo'}`}>{e.solved ? 'Resolvido' : 'Pendente'}</span>
              <button className="btn btn-small" onClick={() => setEditing(e)}>Editar</button>
              <button className="icon-btn" onClick={() => remove(e)} aria-label="Remover exercício">×</button>
            </div>
            {open === e.id && (
              <div className="exercise-body">
                {e.pdfName && (
                  <>
                    <h4>
                      Lista de questões{' '}
                      <a href={exercisePdfURL(e.id)} target="_blank" rel="noreferrer">
                        📄 {e.pdfName} ({fmtBytes(e.pdfSize)}) ↗
                      </a>
                    </h4>
                    <iframe className="pdf-view" src={exercisePdfURL(e.id)} title={e.pdfName} />
                  </>
                )}
                {(e.statement || !e.pdfName) && (
                  <>
                    <h4>Enunciado</h4>
                    <pre>{e.statement || '—'}</pre>
                  </>
                )}
                <details className="solution">
                  <summary>Mostrar resolução</summary>
                  <pre>{e.solution || '—'}</pre>
                </details>
              </div>
            )}
          </article>
        ))}
      </div>

      {editing && (
        <ExerciseForm
          exercise={editing === 'new' ? undefined : editing}
          defaultTopicId={topicFilter || undefined}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  )
}
