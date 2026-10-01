import { type GameEvent, type GameState, type UnitCardInstance } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'

const findUnit = (state: GameState, unitId: string): UnitCardInstance | undefined => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find(
    (unit): unit is UnitCardInstance => unit !== null && unit.instanceId === unitId,
  )
}

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

  const damageTarget = findUnit(state, damageTargetId)

  if (!damageTarget) {
    throw new Error(`Brother's Shoulder target unit "${damageTargetId}" not found`)
  }

  if (damageTarget.ownerId !== casterId) {
    throw new Error("Brother's Shoulder can only deal damage to your own unit")
  }

  const buffTarget = findUnit(state, buffTargetId)

  if (!buffTarget || buffTarget.ownerId !== casterId) {
    throw new Error("Brother's Shoulder can only buff your own ally")
  }

  applyDamageToUnit(state, events, damageTarget, 1)

  const buffedAlly = findUnit(state, buffTargetId)

  if (!buffedAlly) return

  buffedAlly.attack += 2
  buffedAlly.tempAttack = (buffedAlly.tempAttack ?? 0) + 2

  buffedAlly.health += 1
  buffedAlly.maxHealth += 1
  buffedAlly.tempHealth = (buffedAlly.tempHealth ?? 0) + 1
}
