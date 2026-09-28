import {
  KEYWORD,
  type DeclareAttacksAction,
  type GameEvent,
  type GameState,
  type UnitCardInstance,
} from '../../types'
import { TRIGGER } from '../../types/abilities.types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import { triggerUnitAbilities } from '../abilities/trigger-abilities'
import type { ApplyActionResult } from '../apply-action'

export const declareAttacksAction = (
  state: GameState,
  action: DeclareAttacksAction,
): ApplyActionResult => {
  const nextState = structuredClone(state)

  validateDeclareAttacksAction(nextState, action)
  initializeCombatSlots(nextState, action)

  const events: GameEvent[] = []

  triggerAttackAbilities(nextState, events)

  return {
    state: nextState,
    events,
  }
}

function validateDeclareAttacksAction(state: GameState, action: DeclareAttacksAction): void {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to attack`)
  }

  if (state.combat !== null) {
    throw new Error('Cannot declare attacks: combat is already in progress')
  }

  const playerState = state.players[action.playerId]!
  if (!playerState.hasAttackToken) {
    throw new Error(`Player "${action.playerId}" does not have an active attack token`)
  }

  if (action.attackers.length === 0) {
    throw new Error('Cannot declare attack: at least one attacker must be selected')
  }

  const attackersIds = new Set(action.attackers)
  if (attackersIds.size !== action.attackers.length) {
    throw new Error('Cannot declare attack: duplicate attacker IDs detected')
  }

  const allAttackersOnBoard = action.attackers.every((attackerId) =>
    playerState.board.some((unit) => unit.instanceId === attackerId),
  )
  if (!allAttackersOnBoard) {
    throw new Error(
      `Cannot declare attack: one or more attackers are not present on player "${action.playerId}" board`,
    )
  }

  const hasCannotAttackUnit = action.attackers.some((id) => {
    const unit = playerState.board.find((u) => u.instanceId === id)
    return unit?.keywords?.includes(KEYWORD.CANNOT_ATTACK)
  })
  if (hasCannotAttackUnit) {
    throw new Error('Cannot declare attack: one or more attackers have the "cannot_attack" keyword')
  }
}

function initializeCombatSlots(state: GameState, action: DeclareAttacksAction): void {
  const playerState = state.players[action.playerId]!
  const playerBoardCards = playerState.board
  const attackersIds = new Set(action.attackers)

  state.combat = {
    attackerPlayerId: action.playerId,
    defenderPlayerId: getNextPlayerId(state),
    slots: action.attackers.map((cardInstanceId) => {
      const attacker = playerBoardCards.find(
        (card) => card.instanceId === cardInstanceId,
      ) as UnitCardInstance

      return {
        attacker,
        blocker: null,
      }
    }),
  }

  playerState.board = playerBoardCards.filter((card) => !attackersIds.has(card.instanceId))
  playerState.hasAttackToken = false
  state.turnPlayerId = getNextPlayerId(state)
  state.consecutivePasses = 0
}

function triggerAttackAbilities(state: GameState, events: GameEvent[]): void {
  const slots = state.combat!.slots

  for (let i = 0; i < slots.length; i++) {
    const currentSlot = slots[i]!
    const supportedAlly = slots[i + 1]?.attacker

    triggerUnitAbilities(state, events, currentSlot.attacker, TRIGGER.ON_ATTACK, {
      sourceUnit: currentSlot.attacker,
      targetUnit: supportedAlly,
    })
  }
}
