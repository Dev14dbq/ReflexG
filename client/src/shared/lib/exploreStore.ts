import { ProfileCardSchema, type ProfileCardData } from '@/entities/ProfileCard/ui/ProfileCard'

type ExploreState = {
  currentCard: ProfileCardData | null
}

const STORAGE_KEY = 'explore.currentCard'

function loadFromStorage(): ExploreState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { currentCard: null }
    const parsed = JSON.parse(raw)
    const card = parsed && parsed.currentCard ? ProfileCardSchema.parse(parsed.currentCard) : null
    return { currentCard: card }
  } catch {
    return { currentCard: null }
  }
}

function saveToStorage(state: ExploreState): void {
  try {
    const json = JSON.stringify(state)
    window.localStorage.setItem(STORAGE_KEY, json)
  } catch {}
}

type Listener = (state: ExploreState) => void

class ExploreStore {
  private state: ExploreState
  private listeners: Set<Listener> = new Set()

  constructor() {
    this.state = loadFromStorage()
  }

  getState(): ExploreState { return this.state }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setCard(next: unknown): void {
    try {
      const card = ProfileCardSchema.parse(next)
      this.state = { currentCard: card }
      saveToStorage(this.state)
      this.listeners.forEach(l => { try { l(this.state) } catch {} })
    } catch {
      // ignore invalid payloads
    }
  }

  clear(): void {
    this.state = { currentCard: null }
    saveToStorage(this.state)
    this.listeners.forEach(l => { try { l(this.state) } catch {} })
  }
}

export const exploreStore = new ExploreStore()


