import type { CardInstance, UnitCardInstance } from './card.types'

export interface PlayerState {
  id: string
  reputation: number
  maxEnergy: number
  energy: number
  reservedEnergy: number
  mulliganCompleted: boolean
  hasAttackToken: boolean
  deck: CardInstance[]
  hand: CardInstance[]
  board: UnitCardInstance[]
  graveyard: CardInstance[]
}

export interface CombatSlot {
  attackerId: string
  blockerId: string | null
}

export interface CombatState {
  attackerPlayerId: string
  defenderPlayerId: string
  slots: CombatSlot[]
}

export const PHASE = {
  MULLIGAN: 'mulligan',
  PLAYING: 'playing',
  FINISHED: 'finished',
} as const

export type Phase = (typeof PHASE)[keyof typeof PHASE]

export interface GameState {
  phase: Phase
  rngState: number
  round: number
  players: Record<string, PlayerState>
  initiativePlayerId: string
  turnPlayerId: string
  combat: CombatState | null
  winnerPlayerId: string | null
  consecutivePasses: number
}
