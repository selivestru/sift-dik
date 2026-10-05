import type { ZodType } from 'zod'

import type { GameEvent, GameState, StackSpell } from './index'

export interface SpellContext {
  spellItem: StackSpell
  payload?: Record<string, unknown>
}

export type SpellHandler = (state: GameState, events: GameEvent[], context: SpellContext) => void

export interface SpellHandlerEntry {
  execute: SpellHandler
  validateTargets?: (state: GameState, spellItem: StackSpell) => void
  payloadSchema?: ZodType<Record<string, unknown>>
}

export const SPELL_TYPES = {
  PREEMPTIVE_STRIKE: 'preemptive-strike',
  TEMP_STUN: 'temp-stun',
  TEMP_BURST: 'temp-burst',
  TEMP_SLOW: 'temp-slow',
  BROTHERS_SHOULDER: 'brothers-shoulder',
  ALWAYS_AND_FOREVER: 'always-and-forever',
  LOW_BLOW: 'low-blow',
  BROTHERHOOD: 'brotherhood',
  WILL_BLOOM_AGAIN: 'will-bloom-again',
  PORTRAIT: 'portrait',
  WARM_UP_THE_CROWD: 'warm-up-the-crowd',
  SWIPER: 'swiper',
  MUTUAL_MATCH: 'mutual-match',
  SWIPE_LEFT: 'swipe-left',
  SUPER_LIKE: 'super-like',
  SIGNATURE_DISH: 'signature-dish',
  WATER_GUN: 'water-gun',
} as const

export type SpellType = (typeof SPELL_TYPES)[keyof typeof SPELL_TYPES]
