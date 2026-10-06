import { findLiveUnit } from '../../utils/find-unit'
import type { GameEvent, GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'


export const handleTempSlow = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) return

  const target = findLiveUnit(state, targetId)

  if (!target) return

  target.attack += 1
  target.health += 1
  target.maxHealth += 1
}
