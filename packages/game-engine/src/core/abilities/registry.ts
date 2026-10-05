import { ABILITY, TRIGGER, type AbilityHandlerMap } from '../../types/abilities.types'
import { handleDerekBrotherhood } from './handlers/derek-brotherhood'
import { handleDerekRevenge } from './handlers/derek-revenge'
import { handleDerekSearch } from './handlers/derek-search'
import { handleJacobMending } from './handlers/jacob-mending'
import { handleJamieBloom } from './handlers/jamie-bloom'
import { handleJosyDraw } from './handlers/josy-draw'
import { handleMayaSearch } from './handlers/maya-search'
import { handleMayaSupport } from './handlers/maya-support'
import { handleMayaVengeance } from './handlers/maya-vengeance'
import { handleRustyRally } from './handlers/rusty-rally'
import { handleRustyRecruitment } from './handlers/rusty-recruitment'
import { handleTommyInvite } from './handlers/tommy-invite'
import { handleTremoloPath, tremoloPathPayloadSchema } from './handlers/tremolo-path'
import { handleTremoloSupport } from './handlers/tremolo-support'

export const ABILITIES: AbilityHandlerMap = {
  [ABILITY.TREMOLO_PATH]: {
    trigger: TRIGGER.ON_SUMMON,
    execute: handleTremoloPath,
    payloadSchema: tremoloPathPayloadSchema,
  },
  [ABILITY.TREMOLO_SUPPORT]: { trigger: TRIGGER.ON_ATTACK, execute: handleTremoloSupport },
  [ABILITY.DEREK_SEARCH]: { trigger: TRIGGER.ON_SUMMON, execute: handleDerekSearch },
  [ABILITY.DEREK_BROTHERHOOD]: { trigger: TRIGGER.ON_ATTACK, execute: handleDerekBrotherhood },
  [ABILITY.DEREK_REVENGE]: { trigger: TRIGGER.ON_ALLY_DEATH, execute: handleDerekRevenge },
  [ABILITY.MAYA_SEARCH]: { trigger: TRIGGER.ON_SUMMON, execute: handleMayaSearch },
  [ABILITY.MAYA_SUPPORT]: { trigger: TRIGGER.ON_ATTACK, execute: handleMayaSupport },
  [ABILITY.MAYA_VENGEANCE]: { trigger: TRIGGER.ON_ALLY_DEATH, execute: handleMayaVengeance },
  [ABILITY.JOSY_DRAW]: { trigger: TRIGGER.ON_REPUTATION_STRIKE, execute: handleJosyDraw },
  [ABILITY.RUSTY_RECRUITMENT]: { trigger: TRIGGER.ON_SUMMON, execute: handleRustyRecruitment },
  [ABILITY.RUSTY_RALLY]: { trigger: TRIGGER.ON_ATTACK, execute: handleRustyRally },
  [ABILITY.JAMIE_BLOOM]: { trigger: TRIGGER.ON_ROUND_END, execute: handleJamieBloom },
  [ABILITY.JACOB_MENDING]: { trigger: TRIGGER.ON_SUMMON, execute: handleJacobMending },
  [ABILITY.TOMMY_INVITE]: { trigger: TRIGGER.ON_ATTACK, execute: handleTommyInvite },
}
