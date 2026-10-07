import { useCallback, useEffect, useRef, useState } from 'react'

// Cache em memória das respostas da API: ao trocar de aba a página aparece na hora
// com os últimos dados e é atualizada em segundo plano.
const cache = new Map<string, unknown>()

/** Busca e guarda no cache (usado para pré-carregar páginas). */
export async function prefetch<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  try {
    cache.set(key, await fetcher())
  } catch {
    // a página tenta de novo ao abrir
  }
}

/**
 * Dados de `fetcher` guardados em `key`. Recarrega quando `key` ou `deps` mudam.
 * `data` é undefined só na primeira carga sem cache.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined)
  const [error, setError] = useState('')
  const current = useRef(key)
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  const reload = useCallback(async () => {
    try {
      const value = await fetchRef.current()
      cache.set(key, value)
      if (current.current === key) {
        setData(value)
        setError('')
      }
    } catch (e) {
      if (current.current === key) setError(e instanceof Error ? e.message : 'Falha ao carregar')
    }
  }, [key])

  useEffect(() => {
    current.current = key
    setData(cache.get(key) as T | undefined)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps])

  return { data, error, reload }
}
