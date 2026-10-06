import type { GameState, UnitCardInstance } from '../../types'
import { KEYWORD } from '../../types'
import { grantTempKeyword } from '../utils/grant-temp-keyword'
import { removeFromCombat } from './remove-from-combat'

export const stunUnit = (state: GameState, unit: UnitCardInstance): void => {
  grantTempKeyword(unit, KEYWORD.STUNNED)
  const inCombat = state.combat?.slots.some((slot) => slot.attacker.instanceId === unit.instanceId || slot.blocker?.instanceId === unit.instanceId)
  removeFromCombat(state, unit.instanceId)
  if (inCombat && unit.health > 0) state.players[unit.ownerId]!.board.push(unit)
}
