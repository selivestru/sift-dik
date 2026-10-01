import { CHARACTERS } from '../../../constants/characters'
import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleDerekBrotherhood = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const slots = state.combat?.slots ?? []

  const isAttacking = slots.some(
    (slot) => slot.attacker.instanceId === context.sourceUnit.instanceId,
  )
  if (!isAttacking) return

  const isTremoloAttacking = slots.some((slot) => slot.attacker.id === CHARACTERS.TREMOLO)
  if (!isTremoloAttacking) return

  for (const slot of slots) {
    const attacker = slot.attacker

    if (attacker.id !== CHARACTERS.DEREK && attacker.id !== CHARACTERS.TREMOLO) continue

    attacker.attack += 1
    attacker.health += 1
    attacker.maxHealth += 1

    attacker.tempAttack = (attacker.tempAttack ?? 0) + 1
    attacker.tempHealth = (attacker.tempHealth ?? 0) + 1
  }
}
