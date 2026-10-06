import { findLiveUnit } from '../../utils/find-unit'
import { type GameEvent, type GameState, type UnitCardInstance } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'


export const handleBrothersShoulder = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId
  const [damageTargetId, buffTargetId] = spellItem.targets ?? []
  if (!damageTargetId || !buffTargetId) {
    throw new Error("Brother's Shoulder requires a unit to damage and an ally to buff")
  }

  const damageTarget = findLiveUnit(state, damageTargetId)

  if (!damageTarget) {
    return
  }

  if (damageTarget.ownerId !== casterId) {
    throw new Error("Brother's Shoulder can only deal damage to your own unit")
  }

  const buffTarget = findLiveUnit(state, buffTargetId)

  if (buffTarget && buffTarget.ownerId !== casterId) {
    throw new Error("Brother's Shoulder can only buff your own ally")
  }

  applyDamageToUnit(state, events, damageTarget, 1)

  const buffedAlly = findLiveUnit(state, buffTargetId)

  if (!buffedAlly) return

  buffedAlly.attack += 2
  buffedAlly.tempAttack = (buffedAlly.tempAttack ?? 0) + 2

  buffedAlly.health += 1
  buffedAlly.maxHealth += 1
  buffedAlly.tempHealth = (buffedAlly.tempHealth ?? 0) + 1
}
