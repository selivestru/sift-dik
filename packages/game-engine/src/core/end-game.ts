import { GAME_EVENT_TYPE, type GameEvent, type GameState } from '../types'

export const gameIsOver = (state: GameState): boolean => state.phase === 'finished'

export const endGame = (state: GameState, events: GameEvent[], winnerPlayerId: string | null): void => {
  if (state.phase === 'finished') return
  state.phase = 'finished'
  state.winnerPlayerId = winnerPlayerId
  state.isDraw = winnerPlayerId === null
  events.push({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId })
}

export const checkReputation = (state: GameState, events: GameEvent[]): void => {
  const players = Object.values(state.players)
  const defeated = players.filter((player) => player.reputation <= 0)
  if (defeated.length > 0) {
    endGame(state, events, defeated.length === players.length ? null : players.find((player) => player.reputation > 0)!.id)
  }
}
