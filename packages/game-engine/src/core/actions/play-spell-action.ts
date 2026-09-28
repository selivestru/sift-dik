import {
  CARD_TYPE,
  GAME_EVENT_TYPE,
  SPELL_SPEED,
  type GameEvent,
  type GameState,
  type PlaySpellAction,
  type SpellCardInstance,
} from '../../types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import type { ApplyActionResult } from '../apply-action'

export const playSpellAction = (state: GameState, action: PlaySpellAction): ApplyActionResult => {
  const nextState: GameState = structuredClone(state)

  if (nextState.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${nextState.winnerPlayerId}`)
  }

  if (nextState.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to act`)
  }

  const playerState = nextState.players[action.playerId]

  if (!playerState) {
    throw new Error(`Player with ID "${action.playerId}" not found`)
  }

  const card = playerState.hand.find((c) => c.instanceId === action.cardInstanceId)

  if (!card) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" not found in player hand`)
  }

  if (card.type !== CARD_TYPE.SPELL) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" is not a spell card`)
  }

  const spellCard = card as SpellCardInstance

  if (spellCard.speed === SPELL_SPEED.SLOW && nextState.combat !== null) {
    throw new Error('Cannot play slow spell while combat is in progress')
  }

  const availableEnergy = playerState.energy + playerState.reservedEnergy

  if (availableEnergy < spellCard.cost) {
    throw new Error(
      `Not enough energy to play spell (required: ${spellCard.cost}, available: ${availableEnergy})`,
    )
  }

  if (action.targetUnitInstanceId) {
    const allBoardUnits = Object.values(nextState.players).flatMap((p) => p.board)
    const combatUnits = nextState.combat
      ? nextState.combat.slots.flatMap((s) => [s.attacker, s.blocker].filter(Boolean))
      : []

    const targetExists = [...allBoardUnits, ...combatUnits].some(
      (unit) => unit?.instanceId === action.targetUnitInstanceId,
    )

    if (!targetExists) {
      throw new Error(
        `Target unit with instance ID "${action.targetUnitInstanceId}" not found on board or in combat`,
      )
    }
  }

  const events: GameEvent[] = []

  let costLeft = card.cost
  const reservedToSpend = Math.min(playerState.reservedEnergy, costLeft)
  playerState.reservedEnergy -= reservedToSpend
  costLeft -= reservedToSpend

  if (reservedToSpend > 0) {
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: action.playerId,
      energy: playerState.reservedEnergy,
      isReserved: true,
    })
  }

  if (costLeft > 0) {
    playerState.energy -= costLeft
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: action.playerId,
      energy: playerState.energy,
      isReserved: false,
    })
  }

  playerState.hand = playerState.hand.filter((c) => c.instanceId !== action.cardInstanceId)

  nextState.spellStack.push({
    spell: spellCard,
    targetUnitInstanceId: action.targetUnitInstanceId,
  })

  nextState.turnPlayerId = getNextPlayerId(nextState)
  nextState.consecutivePasses = 0

  return {
    state: nextState,
    events,
  }
}
