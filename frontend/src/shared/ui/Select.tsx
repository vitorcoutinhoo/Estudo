import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<V> {
  value: V
  label: string
  /** Opções com o mesmo grupo aparecem juntas sob um cabeçalho (na ordem recebida). */
  group?: string
}

interface Props<V> {
  value: V
  options: SelectOption<V>[]
  onChange: (v: V) => void
  disabled?: boolean
  /** Mostra a busca. Padrão: só quando há muitas opções. */
  searchable?: boolean
  placeholder?: string
  /** Versão menor, para barras de filtro. */
  compact?: boolean
  'aria-label'?: string
}

const SEARCH_THRESHOLD = 8

/** Busca sem diferenciar maiúsculas nem acentos. */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Converte um mapa valor → rótulo (ex.: STATUS_LABEL) em opções. */
export const labelOptions = <K extends string>(labels: Record<K, string>): SelectOption<K>[] =>
  (Object.keys(labels) as K[]).map((k) => ({ value: k, label: labels[k] }))

/** Select estilizado: lista própria (em vez da nativa), com grupos, busca e teclado. */
export function Select<V extends string | number>({
  value,
  options,
  onChange,
  disabled,
  searchable,
  placeholder = 'Selecione…',
  compact,
  'aria-label': ariaLabel,
}: Props<V>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return q ? options.filter((o) => normalize(`${o.group ?? ''} ${o.label}`).includes(q)) : options
  }, [options, query])

  function show() {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setRect(trigger.current!.getBoundingClientRect())
    setOpen(true)
  }

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) trigger.current?.focus()
  }

  function pick(o: SelectOption<V>) {
    onChange(o.value)
    close()
  }

  // a lista fica num portal (para não ser cortada pelo modal), então acompanha o botão
  useEffect(() => {
    if (!open) return
    const place = () => trigger.current && setRect(trigger.current.getBoundingClientRect())
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!popup.current?.contains(t) && !trigger.current?.contains(t)) close(false)
    }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', outside)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', outside)
    }
  }, [open])

  useLayoutEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[active]) pick(filtered[active])
        break
      case 'Escape':
        // não deixa o Esc chegar ao Modal (que fecharia o formulário inteiro)
        e.preventDefault()
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  const below = rect ? window.innerHeight - rect.bottom : 0
  const up = rect !== null && below < 260 && rect.top > below

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`select-trigger ${compact ? 'is-compact' : ''}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
      >
        <span className="select-value">
          {selected ? (
            <>
              {selected.group && <span className="select-group-hint">{selected.group} · </span>}
              {selected.label}
            </>
          ) : (
            <span className="muted">{placeholder}</span>
          )}
        </span>
        <span className="select-caret" aria-hidden>▾</span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popup}
            className="select-popup"
            style={{
              left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 8),
              minWidth: rect.width,
              ...(up ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
            onKeyDown={onKey}
          >
            {withSearch && (
              <input
                className="select-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                placeholder="Buscar…"
                aria-label="Buscar opção"
                autoFocus
              />
            )}
            <ul ref={list} id={listId} role="listbox" className="select-list" tabIndex={withSearch ? undefined : -1}>
              {filtered.length === 0 && <li className="select-empty">Nada encontrado</li>}
              {filtered.map((o, i) => (
                <li key={String(o.value)} role="presentation">
                  {o.group !== undefined && o.group !== filtered[i - 1]?.group && (
                    <div className="select-group">{o.group}</div>
                  )}
                  <div
                    role="option"
                    aria-selected={o.value === value}
                    data-index={i}
                    className={`select-option ${i === active ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                  >
                    {o.label}
                  </div>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
