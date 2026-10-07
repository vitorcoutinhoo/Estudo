import { useState } from 'react'
import { useCached } from '../../shared/cache'
import { addDays, fmtLongDate, fmtMinutes, fmtWeekday, fromISO, todayISO, weekStart } from '../../shared/format'
import { useNav } from '../../shared/nav'
import { PriorityTag } from '../../shared/ui/Tags'
import { SessionForm } from '../sessions/SessionForm'
import { useTopics } from '../topics/TopicsContext'
import { deleteScheduleItem, fmtTimeRange, listSchedule, patchScheduleItem, type ScheduleItem } from './api'
import { ScheduleItemForm } from './ScheduleItemForm'

export const scheduleQuery = (start: string) =>
  [`schedule:${start}`, () => listSchedule(start, addDays(start, 6))] as const

export function SchedulePage() {
  const { topics } = useTopics()
  const { go } = useNav()
  const [date, setDate] = useState(todayISO())
  const [actionError, setActionError] = useState('')
  const [logging, setLogging] = useState<ScheduleItem | null>(null)
  const [editing, setEditing] = useState<ScheduleItem | 'new' | null>(null)

  const start = weekStart(date)
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const { data, error: loadError, reload: load } = useCached(...scheduleQuery(start))
  const items = data ?? []
  const error = actionError || loadError

  const dayItems = items.filter((i) => i.date === date)
  const plannedTotal = dayItems.reduce((s, i) => s + i.plannedMinutes, 0)
  const doneCount = dayItems.filter((i) => i.done).length

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      await load()
      setActionError('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ação falhou')
    }
  }

  const toggle = (i: ScheduleItem) => run(() => patchScheduleItem(i.id, { done: !i.done }))
  const remove = (i: ScheduleItem) => run(() => deleteScheduleItem(i.id))

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Cronograma</h1>
          <p className="muted" style={{ textTransform: 'capitalize' }}>{fmtLongDate(date)}</p>
        </div>
        <div className="date-nav">
          <button className="btn" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button>
          <button className="btn" onClick={() => setDate(todayISO())}>Hoje</button>
          <button className="btn" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">›</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Escolher data" />
        </div>
      </header>

      <div className="week-strip">
        {week.map((d) => {
          const list = items.filter((i) => i.date === d)
          const done = list.filter((i) => i.done).length
          return (
            <button
              key={d}
              className={`week-day ${d === date ? 'is-selected' : ''} ${d === todayISO() ? 'is-today' : ''}`}
              onClick={() => setDate(d)}
            >
              <span className="week-day-name">{fmtWeekday(d)}</span>
              <span className="week-day-num">{fromISO(d).getDate()}</span>
              <span className="week-day-count">{list.length ? `${done}/${list.length}` : '–'}</span>
            </button>
          )
        })}
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="card">
        <div className="card-head">
          <h2>Para estudar neste dia</h2>
          <span className="muted">
            {dayItems.length > 0 ? `${doneCount}/${dayItems.length} concluídos · ${fmtMinutes(plannedTotal)} planejados` : 'Nada planejado'}
          </span>
        </div>

        {dayItems.length === 0 && <div className="empty">Sem itens neste dia.</div>}

        <ul className="schedule-list">
          {dayItems.map((i) => {
            const topic = topics.find((t) => t.id === i.topicId)
            return (
            <li key={i.id} className={`schedule-item ${i.done ? 'is-done' : ''}`}>
              <input type="checkbox" checked={i.done} onChange={() => toggle(i)} aria-label={`Concluir ${i.topicTitle}`} />
              <div className="schedule-main">
                <strong>{i.topicTitle}</strong>
                <span className="schedule-sub">
                  {(i.startTime || i.note) && (
                    <span className="muted">{[fmtTimeRange(i), i.note].filter(Boolean).join(' · ')}</span>
                  )}
                  {topic && topic.exercisesTotal > 0 && (
                    <button className="link-btn muted" onClick={() => go('exercises', i.topicId)} title="Ver exercícios deste tópico">
                      {topic.exercisesSolved}/{topic.exercisesTotal} exercícios →
                    </button>
                  )}
                </span>
              </div>
              <PriorityTag value={i.topicPriority} />
              <span className="schedule-time">{fmtMinutes(i.plannedMinutes)}</span>
              <button className="btn btn-small" onClick={() => setEditing(i)}>Editar</button>
              <button className="btn btn-small" onClick={() => setLogging(i)}>Registrar horas</button>
              <button className="icon-btn" onClick={() => remove(i)} aria-label="Remover do cronograma">×</button>
            </li>
            )
          })}
        </ul>

        <div className="add-row">
          <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={topics.length === 0}>
            + Adicionar período neste dia
          </button>
        </div>
        {topics.length === 0 && <p className="muted">Crie um tópico primeiro para montar o cronograma.</p>}
      </section>

      {editing && (
        <ScheduleItemForm
          item={editing === 'new' ? undefined : editing}
          date={date}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {logging && (
        <SessionForm
          topicId={logging.topicId}
          date={logging.date}
          minutes={logging.plannedMinutes}
          onClose={() => setLogging(null)}
          onSaved={async () => {
            await patchScheduleItem(logging.id, { done: true })
            await load()
          }}
        />
      )}
    </>
  )
}
