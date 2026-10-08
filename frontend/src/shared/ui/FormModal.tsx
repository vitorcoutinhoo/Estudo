import type { FormEvent, ReactNode } from 'react'
import { Modal } from './Modal'

interface Props {
  title: string
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
  error?: string
  saving?: boolean
  /** Desabilita o botão de salvar (além de durante o envio). */
  invalid?: boolean
  submitLabel?: string
  wide?: boolean
}

/** Modal com formulário, mensagem de erro e rodapé Cancelar/Salvar. */
export function FormModal({ title, onClose, onSubmit, children, error, saving, invalid, submitLabel = 'Salvar', wide }: Props) {
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form className="form" onSubmit={submit}>
        {children}
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || invalid}>{submitLabel}</button>
        </footer>
      </form>
    </Modal>
  )
}
