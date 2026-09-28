import type { UnitCardInstance } from './card.types'
import type { GameEvent } from './event.types'
import type { GameState } from './game-state.types'

export const TRIGGER = {
  ON_SUMMON: 'on_summon',
  ON_ATTACK: 'on_attack',
  ON_REPUTATION_STRIKE: 'on_reputation_strike',
  ON_KILL: 'on_kill',
  ON_DEATH: 'on_death',
  ON_ROUND_START: 'on_round_start',
  ON_ROUND_END: 'on_round_end',
} as const

export type TriggerType = (typeof TRIGGER)[keyof typeof TRIGGER]

export const ABILITY = {
  TREMOLO_SUPPORT: 'tremolo_support',
  TREMOLO_REPUTATION_STRIKE: 'tremolo_reputation_strike',
} as const

export type AbilityType = (typeof ABILITY)[keyof typeof ABILITY]

export interface AbilityContext {
  sourceUnit: UnitCardInstance
  targetUnit?: UnitCardInstance
}

export interface AbilityHandler {
  trigger: TriggerType
  execute: (state: GameState, events: GameEvent[], context: AbilityContext) => void
}
