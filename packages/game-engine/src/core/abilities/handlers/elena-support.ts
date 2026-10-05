import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SupportAbilityContext } from '../../../types/abilities.types'
import { grantTempKeyword } from '../../utils/grant-temp-keyword'

export const handleElenaSupport = (
  state: GameState,
  _events: GameEvent[],
  { sourceUnit, targetUnit }: SupportAbilityContext,
): void => {
  if (!state.combat || !targetUnit) return

  grantTempKeyword(sourceUnit, KEYWORD.TOUGH)
  grantTempKeyword(targetUnit, KEYWORD.TOUGH)
}
