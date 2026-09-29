import type { GameEvent, GameState, UnitCardInstance } from '../../types'
import type {
  AbilityContext,
  AbilityContextInput,
  AbilityHandler,
  TriggerType,
} from '../../types/abilities.types'
import { ABILITIES } from './registry'

export const triggerUnitAbilities = <C extends AbilityContext>(
  state: GameState,
  events: GameEvent[],
  unit: UnitCardInstance,
  trigger: TriggerType,
  baseContext: C,
  abilityContexts?: AbilityContextInput,
): void => {
  if (!unit.abilities) return

  for (const abilityId of unit.abilities) {
    const handler = ABILITIES[abilityId] as AbilityHandler<AbilityContext> | undefined

    if (handler && handler.trigger === trigger) {
      const payload = abilityContexts?.[abilityId] ?? {}
      handler.execute(state, events, { ...baseContext, ...payload })
    }
  }
}
