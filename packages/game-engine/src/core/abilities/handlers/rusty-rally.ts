import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleRustyRally = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const slots = state.combat?.slots ?? []

  for (const slot of slots) {
    const attacker = slot.attacker

    if (attacker.instanceId === context.sourceUnit.instanceId) continue

    attacker.attack += 1
    attacker.health += 1
    attacker.maxHealth += 1

    attacker.tempAttack = (attacker.tempAttack ?? 0) + 1
    attacker.tempHealth = (attacker.tempHealth ?? 0) + 1
  }
}
