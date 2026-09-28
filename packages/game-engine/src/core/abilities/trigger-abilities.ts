import type { GameEvent, GameState, UnitCardInstance } from '../../types'
import type { AbilityContext, TriggerType } from '../../types/abilities.types'
import { ABILITIES } from './registry'

export const triggerUnitAbilities = (
  state: GameState,
  events: GameEvent[],
  unit: UnitCardInstance,
  trigger: TriggerType,
  context: AbilityContext,
): void => {
  if (!unit.abilities) return

  for (const abilityId of unit.abilities) {
    const handler = ABILITIES[abilityId]

    if (handler && handler.trigger === trigger) {
      handler.execute(state, events, context)
    }
  }
}
