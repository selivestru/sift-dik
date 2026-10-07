import type { MulliganChangeCardsAction } from '~/types/action.types'
import { GAME_EVENT_TYPE, type GameEvent, type MulliganCompletedEvent } from '~/types/event.types'
import { PHASE, type GameState, type PlayerState } from '~/types/game-state.types'
import { createRng } from '~/utils/create-rng'
import { getPlayer } from '~/utils/get-player'
import { getSecondPlayer } from '~/utils/get-second-player'
import { shuffle } from '~/utils/shuffle'

import type { ApplyActionResult } from '../apply-action'
import { startRound } from '../start-round'

export function mulliganChangeCardsAction(
  state: GameState,
  action: MulliganChangeCardsAction,
): ApplyActionResult {
  if (state.phase !== PHASE.MULLIGAN) {
    throw new Error('Cannot change cards in this phase')
  }

  const player = getPlayer(state.players, action.playerId)

  if (player.mulliganCompleted) {
    throw new Error('Player already completed mulligan')
  }

  const events: GameEvent[] = []

  const cardInstanceIds = new Set(action.cardInstanceIds)

  if (cardInstanceIds.size !== action.cardInstanceIds.length) {
    throw new Error('Duplicate card instance ids')
  }

  const handIds = new Set(player.hand.map((card) => card.instanceId))
  const hasCards = action.cardInstanceIds.every((instanceId) => handIds.has(instanceId))

  if (!hasCards) {
    throw new Error('Player does not have cards to mulligan')
  }

  if (player.deck.length < cardInstanceIds.size) {
    throw new Error('Not enough cards in deck to mulligan')
  }

  const mulliganEvent: MulliganCompletedEvent = {
    type: GAME_EVENT_TYPE.MULLIGAN_COMPLETED,
    playerId: player.id,
    replacedCardInstanceIds: [],
    receivedCardInstanceIds: [],
  }

  if (cardInstanceIds.size > 0) {
    const replacedCards = player.hand.filter((card) => cardInstanceIds.has(card.instanceId))
    const replacements = player.deck.splice(0, replacedCards.length)

    mulliganEvent.replacedCardInstanceIds = replacedCards.map((card) => card.instanceId)
    mulliganEvent.receivedCardInstanceIds = replacements.map((card) => card.instanceId)

    let replacementIndex = 0

    player.hand = player.hand.map((card) =>
      cardInstanceIds.has(card.instanceId) ? replacements[replacementIndex++]! : card,
    )
    player.deck.push(...replacedCards)
    player.deck = shuffle(player.deck, createRng(state))
  }

  events.push(mulliganEvent)

  completeMulligan(state, player, events)

  return {
    state,
    events,
  }
}

function completeMulligan(state: GameState, player: PlayerState, events: GameEvent[]) {
  player.mulliganCompleted = true

  const secondPlayer = getSecondPlayer(state.players, player.id)

  if (!secondPlayer.mulliganCompleted) {
    return
  }

  startRound(state, events)
}
