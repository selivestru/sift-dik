import type { GameState } from '../types'

export const getNextPlayerId = (game: GameState): string => {
  return Object.keys(game.players).find((playerId) => playerId !== game.turnPlayerId)!
}
