import {
  ABILITY,
  TRIGGER,
  type AbilityHandler,
  type AbilityType,
} from '../../types/abilities.types'
import { handleTremoloReputationStrike } from './handlers/tremolo-reputation-strike'
import { handleTremoloSupport } from './handlers/tremolo-support'

export const ABILITIES: Record<AbilityType, AbilityHandler> = {
  [ABILITY.TREMOLO_SUPPORT]: {
    trigger: TRIGGER.ON_ATTACK,
    execute: handleTremoloSupport,
  },
  [ABILITY.TREMOLO_REPUTATION_STRIKE]: {
    trigger: TRIGGER.ON_REPUTATION_STRIKE,
    execute: handleTremoloReputationStrike,
  },
}
