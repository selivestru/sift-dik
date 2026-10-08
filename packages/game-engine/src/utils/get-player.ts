import type { PlayerState } from '~/types/game-state.types'

export function getPlayer(players: Record<string, PlayerState>, playerId: string): PlayerState {
  const player = players[playerId]

  if (!Object.hasOwn(players, playerId) || !player) {
    throw new Error('Player not found')
  }

  return player
}
