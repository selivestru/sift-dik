import type { GameEvent, GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { stunUnit } from '../../combat/stun-unit'
import { findLiveUnit } from '../../utils/find-unit'

export const handleTempStun = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const target = findLiveUnit(state, spellItem.targets?.[0] ?? '')
  if (target) stunUnit(state, target)
}
