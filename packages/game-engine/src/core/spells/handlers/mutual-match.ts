import { MAX_RESERVED_ENERGY } from '../../../constants/game'
import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { drawCard } from '../../utils/draw-card'

export const handleMutualMatch = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const ownerId = spellItem.spell.ownerId
  const player = state.players[ownerId]!

  drawCard(state, ownerId, events)
  if (state.winnerPlayerId !== null) return

  if (player.reservedEnergy >= MAX_RESERVED_ENERGY) return

  player.reservedEnergy += 1

  events.push({
    type: GAME_EVENT_TYPE.ENERGY_CHANGED,
    playerId: ownerId,
    energy: player.reservedEnergy,
    isReserved: true,
  })
}
