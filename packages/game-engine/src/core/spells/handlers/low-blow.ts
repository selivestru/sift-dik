import { findLiveUnit } from '../../utils/find-unit'
import { type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'
import { stunUnit } from '../../combat/stun-unit'


export const handleLowBlow = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) {
    throw new Error('Low Blow requires a target unit')
  }

  const victim = findLiveUnit(state, targetId)

  if (!victim) {
    return
  }

  if (victim.ownerId === spellItem.spell.ownerId) {
    throw new Error('Low Blow can only target an enemy unit')
  }

  applyDamageToUnit(state, events, victim, 4)

  const stunnedTarget = findLiveUnit(state, targetId)

  if (!stunnedTarget) return

  stunUnit(state, stunnedTarget)
}
