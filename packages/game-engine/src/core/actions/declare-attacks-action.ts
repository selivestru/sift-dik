import {
  UNIT_KEYWORD,
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

  if (nextState.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${nextState.winnerPlayerId}`)
  }

  if (nextState.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to attack`)
  }

  if (nextState.combat !== null) {
    throw new Error('Cannot declare attacks: combat is already in progress')
  }

  const playerState = nextState.players[action.playerId]!

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

  const playerBoardCards = playerState.board

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
    return unit?.keywords?.includes(UNIT_KEYWORD.CANNOT_ATTACK)
  })

  if (hasCannotAttackUnit) {
    throw new Error('Cannot declare attack: one or more attackers have the "cannot_attack" keyword')
  }

  nextState.combat = {
    attackerPlayerId: action.playerId,
    defenderPlayerId: getNextPlayerId(nextState),
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
  nextState.turnPlayerId = getNextPlayerId(nextState)
  nextState.consecutivePasses = 0

  const events: GameEvent[] = []

  const slots = nextState.combat.slots
  for (let i = 0; i < slots.length; i++) {
    const currentSlot = slots[i]!
    const supportedAlly = slots[i + 1]?.attacker

    triggerUnitAbilities(nextState, events, currentSlot.attacker, TRIGGER.ON_ATTACK, {
      sourceUnit: currentSlot.attacker,
      targetUnit: supportedAlly,
    })
  }

  return {
    state: nextState,
    events,
  }
}
