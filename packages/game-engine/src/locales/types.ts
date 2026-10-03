import type { Character } from '../constants/characters'
import type { Keyword } from '../types/card.types'
import type { SpellType } from '../types/spells.types'

export type CardId = Character | SpellType

export type TermKey =
  | Keyword
  | 'summon'
  | 'reputation'
  | 'initiative'
  | 'reserved_energy'
  | 'dik_path'
  | 'neutral_path'
  | 'chick_path'
  | 'support'
  | 'reputation_strike'
  | 'round_end'

export interface TermEntry {
  name: string
  rules: string
}

export interface CardStrings {
  name: string
  description: string
}

export type DescriptionSegment = { kind: 'text'; value: string } | { kind: 'term'; key: string }

export interface Locale {
  cards: Record<CardId, CardStrings>
  terms: Record<TermKey, TermEntry>
}
