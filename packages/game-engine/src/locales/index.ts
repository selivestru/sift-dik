import { en } from './en'
import { ru } from './ru'
import type { CardId, CardStrings, Locale } from './types'

export const LOCALES = { ru, en } as const

export type LocaleCode = keyof typeof LOCALES

export const getLocale = (code: LocaleCode): Locale => LOCALES[code]

export const getCardStrings = (locale: Locale, cardId: CardId): CardStrings => {
  const strings = locale.cards[cardId]

  if (!strings) {
    throw new Error(`Locale has no strings for card "${cardId}"`)
  }

  return strings
}

export { parseDescription } from './parse-description'
export type { CardId, CardStrings, DescriptionSegment, Locale, TermEntry, TermKey } from './types'
