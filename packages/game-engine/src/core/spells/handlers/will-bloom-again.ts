import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

const findUnit = (state: GameState, unitId: string) => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find((unit) => unit?.instanceId === unitId)
}

export const handleWillBloomAgain = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) {
    throw new Error('Will Bloom Again requires a target unit')
  }

  const target = findUnit(state, targetId)

  if (!target) {
    throw new Error(`Will Bloom Again target unit "${targetId}" not found`)
  }

  if (target.ownerId !== spellItem.spell.ownerId) {
    throw new Error('Will Bloom Again can only target your own ally')
  }

  const delta = target.maxHealth - target.health

  if (delta <= 0) return

  target.health = target.maxHealth

  events.push({
    type: GAME_EVENT_TYPE.HEAL_DEALT,
    targetId: target.instanceId,
    amount: delta,
    isReputation: false,
  })
}
