import { describe, expect, test } from 'vitest'

import { tremoloCard } from '../catalog/characters/tremolo'
import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { CHARACTERS } from '../constants/characters'
import { getCardStrings, getLocale, LOCALES, parseDescription } from '../locales'
import type { CardId, DescriptionSegment, TermKey } from '../locales/types'
import { KEYWORD } from '../types'
import { SPELL_TYPES } from '../types/spells.types'

type TermSegment = Extract<DescriptionSegment, { kind: 'term' }>

const isTermSegment = (segment: DescriptionSegment): segment is TermSegment =>
  segment.kind === 'term'

const getTermKeys = (description: string): string[] =>
  parseDescription(description)
    .filter(isTermSegment)
    .map((segment) => segment.key)

describe('Description parser', () => {
  test('Splits a mixed string into text and term segments', () => {
    expect([
      { kind: 'term', key: 'summon' },
      { kind: 'text', value: ': даруйте мне ' },
      { kind: 'term', key: 'quick_attack' },
      { kind: 'text', value: '.' },
    ]).toEqual(parseDescription('{summon}: даруйте мне {quick_attack}.'))
  })

  test('Handles adjacent terms and text without terms', () => {
    expect([
      { kind: 'term', key: 'tough' },
      { kind: 'term', key: 'elusive' },
    ]).toEqual(parseDescription('{tough}{elusive}'))

    expect([{ kind: 'text', value: 'Просто текст.' }]).toEqual(parseDescription('Просто текст.'))
  })

  test('Returns an empty list for an empty string', () => {
    expect(parseDescription('')).toEqual([])
  })
})

describe('Locales', () => {
  const termKeys: TermKey[] = [
    ...Object.values(KEYWORD),
    'summon',
    'reputation',
    'initiative',
    'reserved_energy',
    'dik_path',
    'neutral_path',
    'chick_path',
    'support',
    'reputation_strike',
    'round_end',
  ]

  const cardIds: CardId[] = [
    CHARACTERS.TREMOLO,
    CHARACTERS.DEREK,
    CHARACTERS.MAYA,
    CHARACTERS.JOSY,
    CHARACTERS.JAMIE,
    CHARACTERS.JACOB,
    CHARACTERS.TOMMY,
    CHARACTERS.GUESTS,
    CHARACTERS.LEON,
    SPELL_TYPES.PREEMPTIVE_STRIKE,
    SPELL_TYPES.TEMP_STUN,
    SPELL_TYPES.TEMP_BURST,
    SPELL_TYPES.TEMP_SLOW,
    SPELL_TYPES.BROTHERS_SHOULDER,
    SPELL_TYPES.ALWAYS_AND_FOREVER,
    SPELL_TYPES.LOW_BLOW,
    SPELL_TYPES.WILL_BLOOM_AGAIN,
    SPELL_TYPES.PORTRAIT,
    SPELL_TYPES.WARM_UP_THE_CROWD,
    SPELL_TYPES.SWIPER,
    SPELL_TYPES.MUTUAL_MATCH,
    SPELL_TYPES.SWIPE_LEFT,
    SPELL_TYPES.SUPER_LIKE,
  ]

  test('Every locale provides strings for every card and term', () => {
    for (const code of Object.keys(LOCALES) as Array<keyof typeof LOCALES>) {
      const locale = getLocale(code)

      for (const cardId of cardIds) {
        const strings = getCardStrings(locale, cardId)
        expect(strings.name.length).toBeGreaterThan(0)
        expect(strings.description.length).toBeGreaterThan(0)
      }

      for (const key of termKeys) {
        const term = locale.terms[key as TermKey]
        expect(term.name.length).toBeGreaterThan(0)
        expect(term.rules.length).toBeGreaterThan(0)
      }
    }
  })

  test('Tremolo description resolves every term key in the glossary', () => {
    for (const locale of Object.values(LOCALES)) {
      const { description } = locale.cards[tremoloCard.id as CardId]

      const termSegmentKeys = getTermKeys(description)
      expect(termSegmentKeys.length).toBeGreaterThan(0)

      for (const key of termSegmentKeys) {
        expect(locale.terms[key as TermKey]).toBeDefined()
      }
    }
  })

  test('Preemptive Strike description references quick attack in every locale', () => {
    for (const locale of Object.values(LOCALES)) {
      const { description } = locale.cards[preemptiveStrike.id as CardId]
      expect(parseDescription(description)).toContainEqual({
        kind: 'term',
        key: 'quick_attack',
      })
    }
  })
})
