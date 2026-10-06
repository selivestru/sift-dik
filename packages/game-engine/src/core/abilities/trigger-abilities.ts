import type { GameEvent, GameState, UnitCardInstance } from '../../types'
import {
  TRIGGER,
  type AbilityContext,
  type AbilityContextInput,
  type AbilityHandler,
  type TriggerType,
} from '../../types/abilities.types'
import { ABILITIES } from './registry'
import { gameIsOver } from '../end-game'

export const triggerUnitAbilities = <C extends AbilityContext>(
  state: GameState,
  events: GameEvent[],
  unit: UnitCardInstance,
  trigger: TriggerType,
  baseContext: C,
  abilityContexts?: AbilityContextInput,
): void => {
  if (gameIsOver(state) || !unit.abilities) return

  for (const abilityId of unit.abilities) {
    const handler = ABILITIES[abilityId] as AbilityHandler<AbilityContext> | undefined

    if (gameIsOver(state)) return
    if (handler && handler.trigger === trigger) {
      const payload = abilityContexts?.[abilityId] ?? {}
      handler.execute(state, events, { ...payload, ...baseContext })
    }
  }
}

export const notifyAllyDeath = (
  state: GameState,
  events: GameEvent[],
  deadUnit: UnitCardInstance,
): void => {
  const alliedUnits = [
    ...state.players[deadUnit.ownerId]!.board,
    ...(state.combat
      ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
      : []),
  ].filter(
    (unit): unit is UnitCardInstance =>
      unit !== null &&
      unit.ownerId === deadUnit.ownerId &&
      unit.instanceId !== deadUnit.instanceId &&
      unit.health > 0,
  )

  for (const ally of new Map(alliedUnits.map((unit) => [unit.instanceId, unit])).values()) {
    triggerUnitAbilities(state, events, ally, TRIGGER.ON_ALLY_DEATH, {
      sourceUnit: ally,
      deadUnit,
    })
  }
}
