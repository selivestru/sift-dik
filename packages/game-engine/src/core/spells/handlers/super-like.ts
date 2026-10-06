import { findLiveUnit } from '../../utils/find-unit'
import { type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { applyDamageToUnit } from '../../combat/resolve-combat'
import { stunUnit } from '../../combat/stun-unit'
import { findStrongestEnemyUnit } from '../../utils/enemy-targeting'


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

  const stunnedTarget = findLiveUnit(state, strongestEnemy.instanceId)

  if (!stunnedTarget) return

  stunUnit(state, stunnedTarget)
}
