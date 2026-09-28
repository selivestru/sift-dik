import { SPELL_TYPES, type SpellHandler, type SpellType } from '../../types/spells.types'
import { handlePreemptiveStrike } from './handlers/preemptive-strike'

export const SPELL_REGISTRY: Record<SpellType, SpellHandler> = {
  [SPELL_TYPES.PREEMPTIVE_STRIKE]: handlePreemptiveStrike,
}
