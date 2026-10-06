import { useState } from 'react'
import { fmtMinutes } from '../../shared/format'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { PRIORITY_LABEL, STATUS_LABEL, TagSelect } from '../../shared/ui/Tags'
import { SessionForm } from '../sessions/SessionForm'
import { deleteTopic, updateTopic } from './api'
import { TopicForm } from './TopicForm'
import { TopicImport } from './TopicImport'
import { useTopics } from './TopicsContext'
import type { Priority, Status, Topic } from './types'

export function TopicsPage() {
  const { topics, loading, error, reload } = useTopics()
  const [editing, setEditing] = useState<Topic | 'new' | null>(null)
  const [logging, setLogging] = useState<Topic | null>(null)
  const [importing, setImporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')

  const visible = topics.filter(
    (t) =>
      (statusFilter === 'all' || t.status === statusFilter) &&
      (priorityFilter === 'all' || t.priority === priorityFilter),
  )

  async function patch(t: Topic, changes: Partial<Pick<Topic, 'priority' | 'status'>>) {
    await updateTopic(t.id, {
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      targetMinutes: t.targetMinutes,
      ...changes,
    })
    await reload()
  }

  async function remove(t: Topic) {
    if (!confirm(`Remover "${t.title}"? Horas, cronograma e exercícios deste tópico também serão apagados.`)) return
    await deleteTopic(t.id)
    await reload()
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tópicos</h1>
          <p className="muted">Tudo o que você está estudando, com meta de horas e progresso.</p>
        </div>
        <div className="tag-group">
          <button className="btn" onClick={() => setImporting(true)}>Importar .xlsx</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Novo tópico</button>
        </div>
      </header>

      <div className="toolbar">
        <label className="inline-field">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}>
            <option value="all">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Prioridade
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}>
            <option value="all">Todas</option>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Carregando…</p>}
      {!loading && visible.length === 0 && (
        <div className="empty">
          {topics.length === 0 ? 'Nenhum tópico ainda. Crie o primeiro para começar.' : 'Nenhum tópico com esses filtros.'}
        </div>
      )}

      <div className="topic-list">
        {visible.map((t) => (
          <article key={t.id} className="card topic">
            <div className="topic-head">
              <div>
                <h3>{t.title}</h3>
                {t.description && <p className="muted topic-desc">{t.description}</p>}
              </div>
              <div className="tag-group">
                <TagSelect
                  value={t.priority}
                  options={PRIORITY_LABEL}
                  className={`tag-priority-${t.priority}`}
                  label="Prioridade"
                  onChange={(v) => patch(t, { priority: v })}
                />
                <TagSelect
                  value={t.status}
                  options={STATUS_LABEL}
                  className={`tag-status-${t.status}`}
                  label="Status"
                  onChange={(v) => patch(t, { status: v })}
                />
              </div>
            </div>

            <div className="topic-progress">
              <ProgressBar value={t.progress} label={`Progresso de ${t.title}`} />
              <strong className="percent">{t.progress}%</strong>
            </div>

            <div className="topic-meta">
              <span>
                <b>{fmtMinutes(t.studiedMinutes)}</b>
                {t.targetMinutes > 0 && <span className="muted"> / {fmtMinutes(t.targetMinutes)}</span>} estudadas
              </span>
              <span>
                <b>{t.exercisesSolved}</b>
                <span className="muted"> / {t.exercisesTotal}</span> exercícios
              </span>
              <span className="topic-actions">
                <button className="btn btn-small" onClick={() => setLogging(t)}>+ Registrar horas</button>
                <button className="btn btn-small" onClick={() => setEditing(t)}>Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => remove(t)}>Remover</button>
              </span>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <TopicForm
          topic={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {importing && <TopicImport onClose={() => setImporting(false)} onSaved={reload} />}
      {logging && <SessionForm topicId={logging.id} onClose={() => setLogging(null)} onSaved={reload} />}
    </>
  )
}
