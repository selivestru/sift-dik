import type { Keyword, UnitCardInstance } from '../../types'

export const grantTempKeyword = (unit: UnitCardInstance, keyword: Keyword): void => {
  if (unit.keywords?.includes(keyword)) return

  unit.keywords = [...(unit.keywords ?? []), keyword]
  if (!unit.tempKeywords?.includes(keyword)) {
    unit.tempKeywords = [...(unit.tempKeywords ?? []), keyword]
  }
}
