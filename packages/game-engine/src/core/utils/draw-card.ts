import { MAX_CARDS_IN_HAND } from '../../constants/game'
import { GAME_EVENT_TYPE, type CardInstance, type GameEvent, type GameState } from '../../types'

export const drawCard = (
  state: GameState,
  playerId: string,
  events: GameEvent[],
): CardInstance | null => {
  const player = state.players[playerId]!

  if (player.deck.length === 0) {
    const opponentId = Object.keys(state.players).find((id) => id !== playerId)!

    state.winnerPlayerId = opponentId
    events.push({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: opponentId })

    return null
  }

  const drawnCard = player.deck.shift()!

  if (player.hand.length < MAX_CARDS_IN_HAND) {
    player.hand.push(drawnCard)
  } else {
    player.graveyard.push(drawnCard)
  }

  events.push({
    type: GAME_EVENT_TYPE.CARD_DRAWN,
    playerId,
    cardInstanceId: drawnCard.instanceId,
  })

  return drawnCard
}
