import { INIT_ENERGY, MAX_CARDS_IN_HAND, MAX_ENERGY, MAX_RESERVED_ENERGY } from '~/constants/game'
import { GAME_EVENT_TYPE, type GameEvent } from '~/types/event.types'
import { PHASE, type GameState } from '~/types/game-state.types'
import { getSecondPlayer } from '~/utils/get-second-player'

export function startRound(state: GameState, events: GameEvent[]): void {
  const isFirstRound = state.round === 0

  if (!isFirstRound) {
    state.initiativePlayerId = getSecondPlayer(state.players, state.initiativePlayerId).id
  }

  state.round += 1
  state.phase = PHASE.PLAYING
  state.turnPlayerId = state.initiativePlayerId
  state.consecutivePasses = 0

  const players = Object.values(state.players)

  for (const player of players) {
    if (!isFirstRound) {
      const bankedEnergy = Math.min(player.energy, MAX_RESERVED_ENERGY - player.reservedEnergy)

      if (bankedEnergy > 0) {
        player.reservedEnergy += bankedEnergy

        events.push({
          type: GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED,
          playerId: player.id,
          reservedEnergy: player.reservedEnergy,
          bankedEnergy,
        })
      }
    }

    player.hasAttackToken = player.id === state.initiativePlayerId
    player.maxEnergy = Math.min(player.maxEnergy + INIT_ENERGY, MAX_ENERGY)
    player.energy = player.maxEnergy
  }

  events.push({
    type: GAME_EVENT_TYPE.ROUND_STARTED,
    initiativePlayerId: state.initiativePlayerId,
    round: state.round,
  })

  const hasEmptyDeck = players.some((player) => player.deck.length === 0)

  if (!isFirstRound && hasEmptyDeck) {
    state.phase = PHASE.FINISHED
    state.winnerPlayerId = players.find((player) => player.deck.length > 0)?.id ?? null
    events.push({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: state.winnerPlayerId })
    return
  }

  for (const player of players) {
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: player.id,
      energy: player.energy,
    })

    const card = player.deck.shift()!

    if (player.hand.length >= MAX_CARDS_IN_HAND) {
      events.push({
        type: GAME_EVENT_TYPE.CARD_OBLITERATED,
        playerId: player.id,
        cardInstanceId: card.instanceId,
      })
    } else {
      player.hand.push(card)
      events.push({
        type: GAME_EVENT_TYPE.CARD_DRAWN,
        playerId: player.id,
        cardInstanceId: card.instanceId,
      })
    }
  }
}
