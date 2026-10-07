import { useState } from 'react'
import { useCached } from '../../shared/cache'
import { fmtLongDate, fmtMinutes, fmtWeekday, todayISO } from '../../shared/format'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { PriorityTag } from '../../shared/ui/Tags'
import { fmtTimeRange, listSchedule, patchScheduleItem, type ScheduleItem } from '../schedule/api'
import { deleteSession, listSessions, type Session } from '../sessions/api'
import { SessionForm } from '../sessions/SessionForm'
import { useTopics } from '../topics/TopicsContext'
import { getSummary, type Summary } from './api'

export function dashboardQuery() {
  const d = todayISO()
  return [
    `dashboard:${d}`,
    async (): Promise<{ summary: Summary; today: ScheduleItem[]; recent: Session[] }> => {
      const [summary, today, sessions] = await Promise.all([getSummary(d), listSchedule(d, d), listSessions()])
      return { summary, today, recent: sessions.slice(0, 5) }
    },
  ] as const
}

export function DashboardPage() {
  const { topics, reload } = useTopics()
  const [logging, setLogging] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  // recarrega quando os tópicos mudam (horas registradas, status etc.)
  const { data, error, reload: load } = useCached(...dashboardQuery(), [topics])
  const summary = data?.summary
  const today = data?.today ?? []
  const recent = data?.recent ?? []

  async function toggle(i: ScheduleItem) {
    await patchScheduleItem(i.id, { done: !i.done })
    await load()
  }

  async function removeSession(s: Session) {
    await deleteSession(s.id)
    await Promise.all([load(), reload()])
  }

  // tópicos sem meta (avulsos) não entram no progresso
  const tracked = topics.filter((t) => t.targetMinutes > 0)
  const overall = tracked.length ? Math.round(tracked.reduce((sum, t) => sum + t.progress, 0) / tracked.length) : 0
  const max = Math.max(60, ...(summary?.last7Days.map((d) => d.minutes) ?? []))
  const active = tracked.filter((t) => t.status === 'in_progress')
  const dayPct = summary && summary.todayPlanned > 0 ? Math.min(100, Math.round((summary.todayMinutes * 100) / summary.todayPlanned)) : 0

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Painel</h1>
          <p className="muted" style={{ textTransform: 'capitalize' }}>{fmtLongDate(todayISO())}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setLogging(true)}
          disabled={topics.length === 0}
          title={topics.length === 0 ? 'Crie um tópico primeiro (aba Tópicos)' : undefined}
        >
          + Registrar horas
        </button>
      </header>

      {error && <p className="form-error">{error} — a API está rodando?</p>}

      <div className="stat-grid">
        <section className="card stat">
          <span className="stat-label">Estudado hoje</span>
          <strong className="stat-value">{fmtMinutes(summary?.todayMinutes ?? 0)}</strong>
          <span className="muted">
            {summary && summary.todayPlanned > 0 ? `de ${fmtMinutes(summary.todayPlanned)} planejados` : 'nada planejado'}
          </span>
          {summary && summary.todayPlanned > 0 && <ProgressBar value={dayPct} label="Meta do dia" />}
        </section>
        <section className="card stat">
          <span className="stat-label">Total estudado</span>
          <strong className="stat-value">{fmtMinutes(summary?.totalMinutes ?? 0)}</strong>
          <span className="muted">em {summary?.topics ?? 0} tópicos</span>
        </section>
        <section className="card stat">
          <span className="stat-label">Progresso geral</span>
          <strong className="stat-value">{overall}%</strong>
          <span className="muted">{summary?.topicsDone ?? 0} concluídos · {summary?.topicsInProgress ?? 0} em andamento</span>
          <ProgressBar value={overall} label="Progresso geral" />
        </section>
        <section className="card stat">
          <span className="stat-label">Exercícios resolvidos</span>
          <strong className="stat-value">
            {summary?.exercisesSolved ?? 0}
            <span className="stat-of"> / {summary?.exercisesTotal ?? 0}</span>
          </strong>
          <span className="muted">guardados na área de exercícios</span>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Cronograma de hoje</h2>
            <span className="muted">{summary?.todayItemsDone ?? 0}/{summary?.todayItems ?? 0} concluídos</span>
          </div>
          {today.length === 0 && <div className="empty">Nada planejado para hoje. Monte o dia na aba Cronograma.</div>}
          <ul className="schedule-list">
            {today.map((i) => (
              <li key={i.id} className={`schedule-item ${i.done ? 'is-done' : ''}`}>
                <input type="checkbox" checked={i.done} onChange={() => toggle(i)} aria-label={`Concluir ${i.topicTitle}`} />
                <div className="schedule-main">
                  <strong>{i.topicTitle}</strong>
                  {(i.startTime || i.note) && (
                    <span className="muted">{[fmtTimeRange(i), i.note].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
                <PriorityTag value={i.topicPriority} />
                <span className="schedule-time">{fmtMinutes(i.plannedMinutes)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Últimos 7 dias</h2>
            <span className="muted">{fmtMinutes(summary?.last7Days.reduce((s, d) => s + d.minutes, 0) ?? 0)} no total</span>
          </div>
          <div className="bars" role="img" aria-label="Minutos estudados por dia nos últimos 7 dias">
            {(summary?.last7Days ?? []).map((d) => (
              <div key={d.date} className="bar-col" title={`${d.date}: ${fmtMinutes(d.minutes)}`}>
                <span className="bar-value">{d.minutes > 0 ? fmtMinutes(d.minutes) : ''}</span>
                <div className="bar-track">
                  <div className="bar" style={{ height: `${(d.minutes / max) * 100}%` }} />
                </div>
                <span className="bar-label">{fmtWeekday(d.date)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Em andamento</h2>
            <span className="muted">{active.length} tópicos</span>
          </div>
          {active.length === 0 && <div className="empty">Nenhum tópico em andamento.</div>}
          <ul className="mini-topics">
            {active.map((t) => (
              <li key={t.id}>
                <div className="mini-topic-head">
                  <strong>{t.title}</strong>
                  <span className="percent">{t.progress}%</span>
                </div>
                <ProgressBar value={t.progress} label={`Progresso de ${t.title}`} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Registros recentes</h2>
          </div>
          {recent.length === 0 && <div className="empty">Nenhuma hora registrada ainda.</div>}
          <ul className="log-list">
            {recent.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{s.topicTitle}</strong>
                  <span className="muted"> · {s.date.split('-').reverse().slice(0, 2).join('/')}{s.note ? ` · ${s.note}` : ''}</span>
                </div>
                <span className="schedule-time">{fmtMinutes(s.minutes)}</span>
                <button className="btn btn-small" onClick={() => setEditingSession(s)}>Editar</button>
                <button className="icon-btn" onClick={() => removeSession(s)} aria-label="Remover registro">×</button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {logging && <SessionForm onClose={() => setLogging(false)} onSaved={load} />}
      {editingSession && <SessionForm session={editingSession} onClose={() => setEditingSession(null)} onSaved={load} />}
    </>
  )
}
