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
}

export interface CombatState {
  attackerPlayerId: string
  defenderPlayerId: string
  blocksDeclared: boolean
  slots: CombatSlot[]
}

export interface StackSpell {
  spell: SpellCardInstance
  targetUnitInstanceId?: string
}

export interface GameState {
  players: Record<string, PlayerState>
  round: number
  initiativePlayerId: string
  turnPlayerId: string
  combat: CombatState | null
  spellStack: StackSpell[]
  winnerPlayerId: string | null
  consecutivePasses: number
}
