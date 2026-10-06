import { findLiveUnit } from '../../utils/find-unit'
import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'


export const handleWillBloomAgain = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const targetId = spellItem.targets?.[0]

  if (!targetId) {
    throw new Error('Will Bloom Again requires a target unit')
  }

  const target = findLiveUnit(state, targetId)

  if (!target) {
    return
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
