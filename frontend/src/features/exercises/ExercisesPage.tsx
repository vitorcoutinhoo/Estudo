import { useState } from 'react'
import { useCached } from '../../shared/cache'
import { useNav } from '../../shared/nav'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { useTopics } from '../topics/TopicsContext'
import { deleteExercise, listExercises, updateExercise, type Exercise } from './api'
import { ExerciseForm } from './ExerciseForm'

// carrega todos e filtra por tópico no cliente: trocar de tópico não faz nova requisição
export const exercisesQuery = ['exercises', () => listExercises()] as const

export function ExercisesPage() {
  const { topics, reload: reloadTopics } = useTopics()
  const nav = useNav()
  const [topicFilter, setTopicFilter] = useState(nav.topicId ?? 0)
  const [showSolved, setShowSolved] = useState<'all' | 'solved' | 'pending'>('all')
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
          <select value={topicFilter} onChange={(e) => setTopicFilter(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.description ? `${t.description} · ` : ''}{t.title}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Situação
          <select value={showSolved} onChange={(e) => setShowSolved(e.target.value as typeof showSolved)}>
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="solved">Resolvidos</option>
          </select>
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
              <span className={`tag ${e.solved ? 'tag-status-done' : 'tag-status-todo'}`}>{e.solved ? 'Resolvido' : 'Pendente'}</span>
              <button className="btn btn-small" onClick={() => setEditing(e)}>Editar</button>
              <button className="icon-btn" onClick={() => remove(e)} aria-label="Remover exercício">×</button>
            </div>
            {open === e.id && (
              <div className="exercise-body">
                <h4>Enunciado</h4>
                <pre>{e.statement || '—'}</pre>
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
