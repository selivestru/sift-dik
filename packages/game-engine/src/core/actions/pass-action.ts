import { MAX_CARDS_IN_HAND } from '../../constants/game'
import {
  CARD_TYPE,
  GAME_EVENT_TYPE,
  UNIT_KEYWORD,
  type GameEvent,
  type GameState,
  type PassAction,
} from '../../types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import type { ApplyActionResult } from '../apply-action'

export const passAction = (state: GameState, action: PassAction): ApplyActionResult => {
  const nextState = structuredClone(state)

  if (nextState.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${nextState.winnerPlayerId}`)
  }

  if (nextState.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to pass`)
  }

  if (nextState.combat !== null) {
    throw new Error('Cannot pass while combat is in progress. Declare blocks instead')
  }

  const events: GameEvent[] = []

  nextState.consecutivePasses += 1

  if (nextState.consecutivePasses === 2) {
    events.push({ type: GAME_EVENT_TYPE.ROUND_ENDED, round: nextState.round })

    for (const playerId in nextState.players) {
      const player = nextState.players[playerId]!

      for (const card of player.board) {
        const isUnit = card.type === CARD_TYPE.UNIT

        if (!isUnit) continue

        const hasRegeneration = card.keywords?.includes(UNIT_KEYWORD.REGENERATION)

        if (!hasRegeneration) continue
        if (card.health >= card.maxHealth) continue

        const delta = card.maxHealth - card.health

        card.health = card.maxHealth

        events.push({
          type: GAME_EVENT_TYPE.HEAL_DEALT,
          targetId: card.instanceId,
          amount: delta,
          isReputation: false,
        })
      }
    }

    nextState.round += 1

    const prevInitiativeId = nextState.initiativePlayerId
    const nextInitiativeId = Object.keys(nextState.players).find((id) => id !== prevInitiativeId)!

    nextState.initiativePlayerId = nextInitiativeId
    nextState.turnPlayerId = nextInitiativeId

    nextState.players[nextInitiativeId]!.hasAttackToken = true
    nextState.players[prevInitiativeId]!.hasAttackToken = false

    events.push({
      type: GAME_EVENT_TYPE.ROUND_STARTED,
      initiativePlayerId: nextState.initiativePlayerId,
      round: nextState.round,
    })

    for (const playerId in nextState.players) {
      const player = nextState.players[playerId]!
      const leftover = player.energy

      player.maxEnergy = Math.min(10, player.maxEnergy + 1)
      player.energy = player.maxEnergy
      player.reservedEnergy = Math.min(3, player.reservedEnergy + leftover)

      events.push(
        {
          type: GAME_EVENT_TYPE.ENERGY_CHANGED,
          playerId,
          energy: player.energy,
          isReserved: false,
        },
        {
          type: GAME_EVENT_TYPE.ENERGY_CHANGED,
          playerId,
          energy: player.reservedEnergy,
          isReserved: true,
        },
      )

      if (player.deck.length === 0) {
        const opponentId = Object.keys(nextState.players).find((id) => id !== playerId)!
        nextState.winnerPlayerId = opponentId
        events.push({ type: GAME_EVENT_TYPE.GAME_OVER, winnerPlayerId: opponentId })
        break
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
    }

    nextState.consecutivePasses = 0

    return {
      state: nextState,
      events,
    }
  }

  nextState.turnPlayerId = getNextPlayerId(nextState)

  return {
    state: nextState,
    events,
  }
}
