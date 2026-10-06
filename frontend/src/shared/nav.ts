import { createContext, useContext } from 'react'

export type PageKey = 'dashboard' | 'schedule' | 'topics' | 'exercises'

interface Nav {
  /** Página atual recebe o tópico selecionado ao navegar (ex.: exercícios de um tópico). */
  topicId?: number
  go: (page: PageKey, topicId?: number) => void
}

export const NavContext = createContext<Nav>({ go: () => {} })

export const useNav = () => useContext(NavContext)
