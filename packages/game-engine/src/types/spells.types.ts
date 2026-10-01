import type { GameEvent, GameState, StackSpell } from './index'

export interface SpellContext {
  spellItem: StackSpell
}

export type SpellHandler = (state: GameState, events: GameEvent[], context: SpellContext) => void

export const SPELL_TYPES = {
  PREEMPTIVE_STRIKE: 'preemptive-strike',
  TEMP_STUN: 'temp-stun',
  TEMP_BURST: 'temp-burst',
  TEMP_SLOW: 'temp-slow',
} as const

export type SpellType = (typeof SPELL_TYPES)[keyof typeof SPELL_TYPES]
