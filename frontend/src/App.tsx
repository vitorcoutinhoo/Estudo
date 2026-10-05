import { useState } from 'react'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ExercisesPage } from './features/exercises/ExercisesPage'
import { SchedulePage } from './features/schedule/SchedulePage'
import { TopicsPage } from './features/topics/TopicsPage'
import { TopicsProvider, useTopics } from './features/topics/TopicsContext'

const PAGES = {
  dashboard: { label: 'Painel', icon: '◧', view: DashboardPage },
  schedule: { label: 'Cronograma', icon: '▤', view: SchedulePage },
  topics: { label: 'Tópicos', icon: '◉', view: TopicsPage },
  exercises: { label: 'Exercícios', icon: '✎', view: ExercisesPage },
} as const

type PageKey = keyof typeof PAGES

function ApiBanner() {
  const { error, reload } = useTopics()
  if (!error) return null
  return (
    <div className="form-error banner" role="alert">
      Não foi possível carregar os dados ({error}). Verifique se a API e o banco estão rodando.
      <button className="btn btn-small" onClick={() => void reload()}>Tentar de novo</button>
    </div>
  )
}

function Shell() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const View = PAGES[page].view

  return (
    <>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">E</span>
            <span>Estudo</span>
          </div>
          <nav>
            {(Object.keys(PAGES) as PageKey[]).map((k) => (
              <button key={k} className={`nav-item ${page === k ? 'is-active' : ''}`} onClick={() => setPage(k)}>
                <span className="nav-icon" aria-hidden>{PAGES[k].icon}</span>
                {PAGES[k].label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="content">
          <ApiBanner />
          <View />
        </main>
      </div>
    </>
  )
}

export default function App() {
  return (
    <TopicsProvider>
      <Shell />
    </TopicsProvider>
  )
}
