import { CHARACTERS } from '../../../constants/characters'
import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SupportAbilityContext } from '../../../types/abilities.types'
import { grantTempKeyword } from '../../utils/grant-temp-keyword'
import { fullyHealUnit } from '../../utils/heal-unit'

export const handleJohnBoySupport = (
  state: GameState,
  events: GameEvent[],
  { sourceUnit, targetUnit }: SupportAbilityContext,
): void => {
  if (!state.combat || !targetUnit) return

  fullyHealUnit(sourceUnit, events)
  fullyHealUnit(targetUnit, events)

  if (targetUnit.id === CHARACTERS.ELENA) {
    grantTempKeyword(targetUnit, KEYWORD.BARRIER)
  }
}
