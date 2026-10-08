import type { GameState, PlayerState } from '~/types/game-state.types'

export function getSecondPlayer(players: GameState['players'], knownId: string): PlayerState {
  return Object.values(players).find((p) => p.id !== knownId)!
}
