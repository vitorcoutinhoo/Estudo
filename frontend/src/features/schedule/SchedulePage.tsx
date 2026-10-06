import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { addDays, fmtLongDate, fmtMinutes, fmtWeekday, fromISO, todayISO, weekStart } from '../../shared/format'
import { useNav } from '../../shared/nav'
import { PriorityTag } from '../../shared/ui/Tags'
import { SessionForm } from '../sessions/SessionForm'
import { useTopics } from '../topics/TopicsContext'
import { createScheduleItem, deleteScheduleItem, listSchedule, patchScheduleItem, type ScheduleItem } from './api'

export function SchedulePage() {
  const { topics } = useTopics()
  const { go } = useNav()
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [error, setError] = useState('')
  const [logging, setLogging] = useState<ScheduleItem | null>(null)

  const [topicId, setTopicId] = useState(0)
  const [minutes, setMinutes] = useState('60')
  const [note, setNote] = useState('')

  const start = weekStart(date)
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  const load = useCallback(async () => {
    try {
      setItems(await listSchedule(start, addDays(start, 6)))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cronograma')
    }
  }, [start])

  useEffect(() => {
    void load()
  }, [load])

  const dayItems = items.filter((i) => i.date === date)
  const plannedTotal = dayItems.reduce((s, i) => s + i.plannedMinutes, 0)
  const doneCount = dayItems.filter((i) => i.done).length

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ação falhou')
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const chosen = topicId || topics[0]?.id
    if (!chosen) return
    await run(async () => {
      await createScheduleItem({ topicId: chosen, date, plannedMinutes: Number(minutes) || 60, note })
      setNote('')
    })
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

        {dayItems.length === 0 && <div className="empty">Sem itens neste dia. Adicione um tópico abaixo.</div>}

        <ul className="schedule-list">
          {dayItems.map((i) => {
            const topic = topics.find((t) => t.id === i.topicId)
            return (
            <li key={i.id} className={`schedule-item ${i.done ? 'is-done' : ''}`}>
              <input type="checkbox" checked={i.done} onChange={() => toggle(i)} aria-label={`Concluir ${i.topicTitle}`} />
              <div className="schedule-main">
                <strong>{i.topicTitle}</strong>
                <span className="schedule-sub">
                  {i.note && <span className="muted">{i.note}</span>}
                  {topic && topic.exercisesTotal > 0 && (
                    <button className="link-btn muted" onClick={() => go('exercises', i.topicId)} title="Ver exercícios deste tópico">
                      {topic.exercisesSolved}/{topic.exercisesTotal} exercícios →
                    </button>
                  )}
                </span>
              </div>
              <PriorityTag value={i.topicPriority} />
              <span className="schedule-time">{fmtMinutes(i.plannedMinutes)}</span>
              <button className="btn btn-small" onClick={() => setLogging(i)}>Registrar horas</button>
              <button className="icon-btn" onClick={() => remove(i)} aria-label="Remover do cronograma">×</button>
            </li>
            )
          })}
        </ul>

        <form className="add-row" onSubmit={add}>
          <select value={topicId || topics[0]?.id || ''} onChange={(e) => setTopicId(Number(e.target.value))} aria-label="Tópico">
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <input type="number" min="5" step="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutos planejados" title="Minutos planejados" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" />
          <button className="btn btn-primary" disabled={topics.length === 0}>+ Adicionar</button>
        </form>
        {topics.length === 0 && <p className="muted">Crie um tópico primeiro para montar o cronograma.</p>}
      </section>

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
