import { ABILITY, TRIGGER, type AbilityHandlerMap } from '../../types/abilities.types'
import { handleSupport } from './handlers/support'
import { handleTremoloPath, tremoloPathPayloadSchema } from './handlers/tremolo-path'

export const ABILITIES: AbilityHandlerMap = {
  [ABILITY.TREMOLO_PATH]: {
    trigger: TRIGGER.ON_SUMMON,
    execute: handleTremoloPath,
    payloadSchema: tremoloPathPayloadSchema,
  },
  [ABILITY.SUPPORT]: { trigger: TRIGGER.ON_ATTACK, execute: handleSupport },
}
