import { KEYWORD, type DeclareBlocksAction, type GameState } from '../../types'
import type { ApplyActionResult } from '../apply-action'

export const declareBlocksAction = (
  state: GameState,
  action: DeclareBlocksAction,
): ApplyActionResult => {
  const nextState = structuredClone(state)

  validateDeclareBlocksAction(nextState, action)
  assignBlockersToCombatSlots(nextState, action)

  nextState.combat!.blocksDeclared = true
  nextState.consecutivePasses = 0

  if (nextState.winnerPlayerId === null) {
    nextState.turnPlayerId = nextState.combat!.attackerPlayerId
  }

  return {
    state: nextState,
    events: [],
  }
}

function validateDeclareBlocksAction(state: GameState, action: DeclareBlocksAction): void {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }

  if (state.combat === null) {
    throw new Error('Cannot declare blocks: no combat is currently in progress')
  }

  if (state.combat.blocksDeclared) {
    throw new Error('Cannot declare blocks: blockers have already been declared this combat')
  }

  if (state.turnPlayerId !== action.playerId || state.combat.defenderPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to declare blocks`)
  }

  const attackerIds = action.blocks.map((b) => b.attackerInstanceId)
  if (new Set(attackerIds).size !== attackerIds.length) {
    throw new Error('Cannot assign multiple blockers to the same attacker')
  }

  const defenderIds = action.blocks.map((b) => b.defenderInstanceId)
  if (new Set(defenderIds).size !== defenderIds.length) {
    throw new Error('Cannot assign the same defender unit to multiple attackers')
  }

  const combatAttackerIds = new Set(state.combat.slots.map((s) => s.attacker.instanceId))
  const allAttackersValid = attackerIds.every((id) => combatAttackerIds.has(id))
  if (!allAttackersValid) {
    throw new Error('One or more targeted attackers are not present in current combat slots')
  }

  const defenderState = state.players[action.playerId]!
  const defenderBoardIds = new Set(defenderState.board.map((u) => u.instanceId))
  const allDefendersValid = defenderIds.every((id) => defenderBoardIds.has(id))
  if (!allDefendersValid) {
    throw new Error(
      `Cannot declare block: one or more defender units are not present on player "${action.playerId}" board`,
    )
  }
}

function assignBlockersToCombatSlots(state: GameState, action: DeclareBlocksAction): void {
  const defenderState = state.players[action.playerId]!
  const blockerIdSet = new Set(action.blocks.map((b) => b.defenderInstanceId))
  const blockerUnits = defenderState.board.filter((u) => blockerIdSet.has(u.instanceId))

  const hasCannotBlockUnit = blockerUnits.some((unit) =>
    unit.keywords?.includes(KEYWORD.CANNOT_BLOCK),
  )
  if (hasCannotBlockUnit) {
    throw new Error(
      'Cannot declare block: one or more defender units have the "cannot_block" keyword',
    )
  }

  const hasStunnedUnit = blockerUnits.some((unit) => unit.keywords?.includes(KEYWORD.STUNNED))

  if (hasStunnedUnit) {
    throw new Error(
      `Cannot declare block: one or more defender units have the "${KEYWORD.STUNNED}" keyword`,
    )
  }

  defenderState.board = defenderState.board.filter((u) => !blockerIdSet.has(u.instanceId))

  for (const block of action.blocks) {
    const slot = state.combat!.slots.find(
      (s) => s.attacker.instanceId === block.attackerInstanceId,
    )!
    const blockerUnit = blockerUnits.find((u) => u.instanceId === block.defenderInstanceId)!

    const attackerIsElusive = slot.attacker.keywords?.includes(KEYWORD.ELUSIVE)
    const blockerIsElusive = blockerUnit.keywords?.includes(KEYWORD.ELUSIVE)

    if (attackerIsElusive && !blockerIsElusive) {
      throw new Error(
        `Cannot declare block: unit "${blockerUnit.instanceId}" cannot block elusive attacker "${slot.attacker.instanceId}"`,
      )
    }

    const attackerIsPressure = slot.attacker.keywords?.includes(KEYWORD.PRESSURE)
    if (attackerIsPressure && blockerUnit.attack < 3) {
      throw new Error(
        `Cannot declare block: unit "${blockerUnit.instanceId}" has less than 3 attack and cannot block pressure attacker "${slot.attacker.instanceId}"`,
      )
    }

    slot.blocker = blockerUnit
  }
}
