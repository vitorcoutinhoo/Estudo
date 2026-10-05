import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { listTopics } from './api'
import type { Topic } from './types'

interface Ctx {
  topics: Topic[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const TopicsContext = createContext<Ctx | null>(null)

export function TopicsProvider({ children }: { children: ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setTopics(await listTopics())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar tópicos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return <TopicsContext.Provider value={{ topics, loading, error, reload }}>{children}</TopicsContext.Provider>
}

export function useTopics(): Ctx {
  const ctx = useContext(TopicsContext)
  if (!ctx) throw new Error('useTopics fora do TopicsProvider')
  return ctx
}
