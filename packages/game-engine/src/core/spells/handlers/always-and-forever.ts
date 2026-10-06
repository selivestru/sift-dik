import { findLiveUnit } from '../../utils/find-unit'
import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'


export const handleAlwaysAndForever = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) return

  const target = findLiveUnit(state, targetId)

  if (!target) return

  if (!target.keywords) {
    target.keywords = []
  }

  if (!target.keywords.includes(KEYWORD.BARRIER)) {
    target.keywords.push(KEYWORD.BARRIER)
  }
}
