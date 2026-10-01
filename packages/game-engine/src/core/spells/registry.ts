import { SPELL_TYPES, type SpellHandler, type SpellType } from '../../types/spells.types'
import { handlePreemptiveStrike } from './handlers/preemptive-strike'
import { handleTempBurst } from './handlers/temp-burst'
import { handleTempSlow } from './handlers/temp-slow'
import { handleTempStun } from './handlers/temp-stun'

export const SPELL_REGISTRY: Record<SpellType, SpellHandler> = {
  [SPELL_TYPES.PREEMPTIVE_STRIKE]: handlePreemptiveStrike,
  [SPELL_TYPES.TEMP_STUN]: handleTempStun,
  [SPELL_TYPES.TEMP_BURST]: handleTempBurst,
  [SPELL_TYPES.TEMP_SLOW]: handleTempSlow,
}
