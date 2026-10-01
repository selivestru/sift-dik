import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'

const findUnit = (state: GameState, unitId: string) => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find((unit) => unit?.instanceId === unitId)
}

export const handleLowBlow = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) {
    throw new Error('Low Blow requires a target unit')
  }

  const victim = findUnit(state, targetId)

  if (!victim) {
    throw new Error(`Low Blow target unit "${targetId}" not found`)
  }

  if (victim.ownerId === spellItem.spell.ownerId) {
    throw new Error('Low Blow can only target an enemy unit')
  }

  applyDamageToUnit(state, events, victim, 4)

  const stunnedTarget = findUnit(state, targetId)

  if (!stunnedTarget) return

  if (!stunnedTarget.keywords) {
    stunnedTarget.keywords = []
  }

  if (!stunnedTarget.keywords.includes(KEYWORD.STUNNED)) {
    stunnedTarget.keywords.push(KEYWORD.STUNNED)
    stunnedTarget.tempKeywords = [...(stunnedTarget.tempKeywords ?? []), KEYWORD.STUNNED]
  }
}
