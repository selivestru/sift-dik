import {
  CARD_TYPE,
  GAME_EVENT_TYPE,
  SPELL_SPEED,
  type GameEvent,
  type GameState,
  type PlaySpellAction,
  type PlayerState,
  type SpellCardInstance,
} from '../../types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import type { ApplyActionResult } from '../apply-action'
import { resolveSpellItem } from '../spells/resolve-spell-stack'

export const playSpellAction = (state: GameState, action: PlaySpellAction): ApplyActionResult => {
  const nextState: GameState = structuredClone(state)

  const spellCard = validatePlaySpellAction(nextState, action)
  const events: GameEvent[] = []

  spendSpellCost(nextState.players[action.playerId]!, events, action.playerId, spellCard.cost)
  removeSpellFromHand(nextState, action)

  if (spellCard.speed === SPELL_SPEED.BURST) {
    resolveSpellItem(nextState, events, {
      spell: spellCard,
      targets: action.targets,
    })
  } else {
    nextState.spellStack.push({
      spell: spellCard,
      targets: action.targets,
    })
    nextState.turnPlayerId = getNextPlayerId(nextState)
  }

  nextState.consecutivePasses = 0

  return {
    state: nextState,
    events,
  }
}

function validatePlaySpellAction(state: GameState, action: PlaySpellAction): SpellCardInstance {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to act`)
  }

  const playerState = state.players[action.playerId]
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

  if (spellCard.speed === SPELL_SPEED.SLOW && state.combat !== null) {
    throw new Error('Cannot play slow spell while combat is in progress')
  }

  if (spellCard.speed === SPELL_SPEED.SLOW && state.spellStack.length > 0) {
    throw new Error('Cannot play slow spell while other spells are on the stack')
  }

  const availableEnergy = playerState.energy + playerState.reservedEnergy
  if (availableEnergy < spellCard.cost) {
    throw new Error(
      `Not enough energy to play spell (required: ${spellCard.cost}, available: ${availableEnergy})`,
    )
  }

  for (const targetId of action.targets ?? []) {
    validateTargetExists(state, targetId)
  }

  return spellCard
}

function validateTargetExists(state: GameState, targetUnitInstanceId: string): void {
  const allBoardUnits = Object.values(state.players).flatMap((p) => p.board)
  const combatUnits = state.combat
    ? state.combat.slots.flatMap((s) => [s.attacker, s.blocker].filter(Boolean))
    : []

  const targetExists = [...allBoardUnits, ...combatUnits].some(
    (unit) => unit?.instanceId === targetUnitInstanceId,
  )

  if (!targetExists) {
    throw new Error(
      `Target unit with instance ID "${targetUnitInstanceId}" not found on board or in combat`,
    )
  }
}

function spendSpellCost(
  playerState: PlayerState,
  events: GameEvent[],
  playerId: string,
  cost: number,
): void {
  let costLeft = cost
  const reservedToSpend = Math.min(playerState.reservedEnergy, costLeft)
  playerState.reservedEnergy -= reservedToSpend
  costLeft -= reservedToSpend

  if (reservedToSpend > 0) {
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: playerState.reservedEnergy,
      isReserved: true,
    })
  }

  if (costLeft > 0) {
    playerState.energy -= costLeft
    events.push({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId,
      energy: playerState.energy,
      isReserved: false,
    })
  }
}

function removeSpellFromHand(state: GameState, action: PlaySpellAction): void {
  const playerState = state.players[action.playerId]!
  playerState.hand = playerState.hand.filter((c) => c.instanceId !== action.cardInstanceId)
}
