import { useState } from 'react'
import { FormModal } from '../../shared/ui/FormModal'
import { labelOptions, Select } from '../../shared/ui/Select'
import { PRIORITY_LABEL, STATUS_LABEL } from '../../shared/ui/Tags'
import { useSubmit } from '../../shared/useSubmit'
import { createTopic, updateTopic } from './api'
import type { Priority, Status, Topic } from './types'

interface Props {
  topic?: Topic
  onClose: () => void
  onSaved: () => void
}

export function TopicForm({ topic, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(topic?.title ?? '')
  const [description, setDescription] = useState(topic?.description ?? '')
  const [priority, setPriority] = useState<Priority>(topic?.priority ?? 'medium')
  const [status, setStatus] = useState<Status>(topic?.status ?? 'todo')
  const [targetHours, setTargetHours] = useState(String((topic?.targetMinutes ?? 600) / 60))
  const { saving, error, run } = useSubmit()

  const submit = () =>
    run(async () => {
      const body = {
        title,
        description,
        priority,
        status,
        targetMinutes: Math.round((Number(targetHours) || 0) * 60),
      }
      if (topic) await updateTopic(topic.id, body)
      else await createTopic(body)
      onSaved()
      onClose()
    })

  return (
    <FormModal title={topic ? 'Editar tópico' : 'Novo tópico'} onClose={onClose} onSubmit={submit} error={error} saving={saving}>
      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estruturas de dados" autoFocus required />
      </label>
      <label>
        Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="O que será estudado neste tópico" />
      </label>
      <div className="form-row">
        <label>
          Prioridade
          <Select value={priority} options={labelOptions(PRIORITY_LABEL)} onChange={setPriority} />
        </label>
        {Number(targetHours) > 0 && (
          <label>
            Status
            <Select value={status} options={labelOptions(STATUS_LABEL)} onChange={setStatus} />
          </label>
        )}
        <label>
          Meta (horas)
          <input type="number" min="0" step="0.5" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} />
        </label>
      </div>
      {!(Number(targetHours) > 0) && (
        <p className="muted">Sem meta: tópico avulso (ex.: revisões pontuais). Acumula horas e exercícios, mas não tem status nem progresso.</p>
      )}
    </FormModal>
  )
}
