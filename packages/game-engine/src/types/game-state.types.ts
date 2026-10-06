import type { CardInstance, SpellCardInstance, UnitCardInstance } from './card.types'

export interface PlayerState {
  id: string
  reputation: number
  maxEnergy: number
  energy: number
  reservedEnergy: number
  deck: CardInstance[]
  hand: CardInstance[]
  board: UnitCardInstance[]
  graveyard: CardInstance[]
  hasAttackToken: boolean
}

export interface CombatSlot {
  attacker: UnitCardInstance
  blocker: UnitCardInstance | null
  wasBlocked?: boolean
}

export interface CombatState {
  attackerPlayerId: string
  defenderPlayerId: string
  blocksDeclared: boolean
  slots: CombatSlot[]
}

export interface StackSpell {
  spell: SpellCardInstance
  targets?: string[]
  payload?: Record<string, unknown>
}

export interface GameState {
  phase: 'mulligan' | 'playing' | 'finished'
  randomState: number
  mulligan: Record<string, string[] | null> | null
  players: Record<string, PlayerState>
  round: number
  initiativePlayerId: string
  turnPlayerId: string
  combat: CombatState | null
  spellStack: StackSpell[]
  stackInitiatorPlayerId: string | null
  winnerPlayerId: string | null
  isDraw: boolean
  consecutivePasses: number
}
