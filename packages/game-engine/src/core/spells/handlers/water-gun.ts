import type { GameEvent, GameState, StackSpell } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit, applyDirectReputationDamage } from '../../combat/resolve-combat'
import { findLiveUnit } from '../../utils/find-unit'

export const validateWaterGunTargets = (state: GameState, spellItem: StackSpell): void => {
  if (spellItem.targets?.length !== 1) {
    throw new Error('Water Gun requires exactly one unit or Reputation target')
  }

  const targetId = spellItem.targets[0]!

  if (!Object.hasOwn(state.players, targetId) && !findLiveUnit(state, targetId)) {
    throw new Error('Water Gun target must be a live unit or player')
  }
}

export const handleWaterGun = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) return

  if (Object.hasOwn(state.players, targetId)) {
    applyDirectReputationDamage(state, events, targetId, 1)
    return
  }

  const target = findLiveUnit(state, targetId)

  if (target) {
    applyDamageToUnit(state, events, target, 1)
  }
}
