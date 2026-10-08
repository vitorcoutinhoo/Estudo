import { useState } from 'react'
import { errorMessage } from './api'

/** Estado de envio de um formulário: `run` marca `saving` e transforma falhas em `error`. */
export function useSubmit(fallback = 'Erro ao salvar') {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e, fallback))
    } finally {
      setSaving(false)
    }
  }

  return { saving, error, setError, run }
}
