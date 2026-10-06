import { useState, type ChangeEvent } from 'react'
import { fmtMinutes, fromISO } from '../../shared/format'
import { Modal } from '../../shared/ui/Modal'
import { PRIORITY_LABEL } from '../../shared/ui/Tags'
import { importTemplateURL, importTopics } from './api'
import type { ImportResult } from './types'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function TopicImport({ onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)
    setError('')
    if (!f) return
    setBusy(true)
    try {
      setPreview(await importTopics(f, true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler planilha')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!file) return
    setBusy(true)
    try {
      await importTopics(file, false)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar')
      setBusy(false)
    }
  }

  const fresh = preview?.rows.filter((r) => !r.duplicate).length ?? 0

  return (
    <Modal title="Importar tópicos (.xlsx)" onClose={onClose} wide>
      <div className="form">
        <p className="muted">
          A planilha deve ter as colunas <b>Data</b>, <b>Dia</b>, <b>Horário</b>, <b>Área</b>, <b>Tema / Atividade</b>,{' '}
          <b>Prioridade</b> (ALTA, MÉDIA ou BAIXA) e <b>Concluído</b>. Cada linha vira um tópico (meta = duração do horário) e um item no cronograma da data.{' '}
          <a href={importTemplateURL}>Baixar modelo</a>
        </p>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pick} />

        {busy && <p className="muted">Processando…</p>}
        {error && <p className="form-error">{error}</p>}

        {preview && (
          <>
            {preview.errors.length > 0 && (
              <div className="form-error">
                {preview.errors.length} linha(s) ignorada(s):
                <ul>{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            <p className="muted">
              Aba <b>{preview.sheet}</b>: {preview.rows.length} linha(s), {fresh} nova(s)
              {preview.rows.length > fresh && `, ${preview.rows.length - fresh} já importada(s) serão puladas`}.
            </p>
            <div className="import-table">
              <table>
                <thead>
                  <tr><th>Data</th><th>Horário</th><th>Área</th><th>Tema / Atividade</th><th>Prioridade</th><th>Meta</th><th>Concluído</th></tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.duplicate ? 'is-duplicate' : ''} title={r.duplicate ? 'Já importado' : undefined}>
                      <td>{fromISO(r.date).toLocaleDateString('pt-BR')}</td>
                      <td>{r.time}</td>
                      <td>{r.area}</td>
                      <td>{r.title}</td>
                      <td><span className={`tag tag-priority-${r.priority}`}>{PRIORITY_LABEL[r.priority]}</span></td>
                      <td>{r.minutes > 0 ? fmtMinutes(r.minutes) : '—'}</td>
                      <td>{r.done ? 'Sim' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={busy || fresh === 0} onClick={confirm}>
            Importar {fresh > 0 && `${fresh} tópico(s)`}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
