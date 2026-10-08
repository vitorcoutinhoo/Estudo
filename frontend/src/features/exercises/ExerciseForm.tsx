import { useRef, useState, type ChangeEvent } from 'react'
import { fmtBytes } from '../../shared/format'
import { FormModal } from '../../shared/ui/FormModal'
import { useSubmit } from '../../shared/useSubmit'
import { useTopics } from '../topics/TopicsContext'
import { sortTopics, TopicSelect } from '../topics/TopicSelect'
import { createExercise, deleteExercisePdf, updateExercise, uploadExercisePdf, type Exercise } from './api'

const MAX_PDF = 25 * 1024 * 1024

interface Props {
  exercise?: Exercise
  defaultTopicId?: number
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function ExerciseForm({ exercise, defaultTopicId, onClose, onSaved }: Props) {
  const { topics } = useTopics()
  const [topicId, setTopicId] = useState(exercise?.topicId ?? defaultTopicId ?? sortTopics(topics)[0]?.id ?? 0)
  const [title, setTitle] = useState(exercise?.title ?? '')
  const [statement, setStatement] = useState(exercise?.statement ?? '')
  const [solution, setSolution] = useState(exercise?.solution ?? '')
  const [solved, setSolved] = useState(exercise?.solved ?? false)
  const [pdf, setPdf] = useState<File | null>(null)
  const [removePdf, setRemovePdf] = useState(false)
  const { saving, error, setError, run } = useSubmit()
  // se o upload do PDF falhar logo após criar, tentar de novo atualiza em vez de duplicar
  const created = useRef<number | null>(null)

  const currentPdf = !removePdf && exercise?.pdfName ? exercise.pdfName : ''

  function pickPdf(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!f) return
    if (f.size > MAX_PDF) {
      setError(`PDF maior que ${fmtBytes(MAX_PDF)}`)
      return
    }
    setError('')
    setPdf(f)
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ''))
  }

  const submit = () =>
    run(async () => {
      const body = { topicId, title, statement, solution, solved }
      const id = exercise?.id ?? created.current
      const saved = id ? await updateExercise(id, body) : await createExercise(body)
      created.current = saved.id
      if (pdf) await uploadExercisePdf(saved.id, pdf)
      else if (removePdf && exercise?.pdfName) await deleteExercisePdf(saved.id)
      await onSaved()
      onClose()
    })

  return (
    <FormModal
      title={exercise ? 'Editar exercício' : 'Novo exercício'}
      onClose={onClose}
      onSubmit={submit}
      error={error}
      saving={saving}
      invalid={!topicId}
      wide
    >
      <div className="form-row form-row-2">
        <label>
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Lista 3 · questão 7" autoFocus required />
        </label>
        <label>
          Tópico
          <TopicSelect value={topicId} onChange={setTopicId} />
        </label>
      </div>
      <div className="pdf-field">
        <span>Lista de questões (PDF)</span>
        {pdf ? (
          <div className="pdf-chip">
            📄 {pdf.name} <span className="muted">({fmtBytes(pdf.size)})</span>
            <button type="button" className="icon-btn" onClick={() => setPdf(null)} aria-label="Descartar PDF">×</button>
          </div>
        ) : currentPdf ? (
          <div className="pdf-chip">
            📄 {currentPdf} <span className="muted">({fmtBytes(exercise!.pdfSize)})</span>
            <button type="button" className="icon-btn" onClick={() => setRemovePdf(true)} aria-label="Remover PDF">×</button>
          </div>
        ) : null}
        <label className="btn btn-small file-btn">
          {pdf || currentPdf ? 'Trocar PDF' : 'Anexar PDF'}
          <input type="file" accept="application/pdf,.pdf" onChange={pickPdf} hidden />
        </label>
      </div>
      <label>
        Enunciado
        <textarea className="mono" value={statement} onChange={(e) => setStatement(e.target.value)} rows={5} placeholder="Cole o enunciado ou um link" />
      </label>
      <label>
        Resolução / anotações
        <textarea className="mono" value={solution} onChange={(e) => setSolution(e.target.value)} rows={7} placeholder="Sua solução, código ou o que aprendeu" />
      </label>
      <label className="check">
        <input type="checkbox" checked={solved} onChange={(e) => setSolved(e.target.checked)} />
        Já resolvi este exercício
      </label>
    </FormModal>
  )
}
