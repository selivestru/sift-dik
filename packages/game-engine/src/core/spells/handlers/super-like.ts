import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'
import { findStrongestEnemyUnit } from '../../utils/enemy-targeting'

const findUnit = (state: GameState, unitId: string) => {
  const boardUnits = Object.values(state.players).flatMap((player) => player.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((slot) => [slot.attacker, slot.blocker].filter(Boolean))
    : []

  return [...boardUnits, ...combatUnits].find((unit) => unit?.instanceId === unitId)
}

export const handleSuperLike = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId
  const opponentId = Object.keys(state.players).find((id) => id !== casterId)!

  const strongestEnemy = findStrongestEnemyUnit(state, opponentId)

  if (!strongestEnemy) return

  applyDamageToUnit(state, events, strongestEnemy, 2)

  const stunnedTarget = findUnit(state, strongestEnemy.instanceId)

  if (!stunnedTarget) return

  if (!stunnedTarget.keywords) {
    stunnedTarget.keywords = []
  }

  if (!stunnedTarget.keywords.includes(KEYWORD.STUNNED)) {
    stunnedTarget.keywords.push(KEYWORD.STUNNED)
    stunnedTarget.tempKeywords = [...(stunnedTarget.tempKeywords ?? []), KEYWORD.STUNNED]
  }
}
