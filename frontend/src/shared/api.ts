export const BASE = import.meta.env.VITE_API_URL ?? ''

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const form = body instanceof FormData
  const res = await fetch(BASE + path, {
    method,
    headers: body && !form ? { 'Content-Type': 'application/json' } : undefined,
    body: form ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? `Erro ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

/** Mensagem legível de um erro qualquer (ex.: o lançado por `api`). */
export const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
