import { SPELL_TYPES, type SpellHandlerEntry, type SpellType } from '../../types/spells.types'
import { handleAlwaysAndForever } from './handlers/always-and-forever'
import { handleBrotherhood } from './handlers/brotherhood'
import { handleBrothersShoulder } from './handlers/brothers-shoulder'
import { handleLowBlow } from './handlers/low-blow'
import { handleMutualMatch } from './handlers/mutual-match'
import { handlePortrait } from './handlers/portrait'
import { handlePreemptiveStrike } from './handlers/preemptive-strike'
import { handleSignatureDish, validateSignatureDishTargets } from './handlers/signature-dish'
import { handleSuperLike } from './handlers/super-like'
import { handleSwipeLeft } from './handlers/swipe-left'
import { handleSwiper, swiperOptionPayloadSchema } from './handlers/swiper'
import { handleTempBurst } from './handlers/temp-burst'
import { handleTempSlow } from './handlers/temp-slow'
import { handleTempStun } from './handlers/temp-stun'
import { handleWarmUpTheCrowd } from './handlers/warm-up-the-crowd'
import { handleWaterGun, validateWaterGunTargets } from './handlers/water-gun'
import { handleWillBloomAgain } from './handlers/will-bloom-again'

export const SPELL_REGISTRY: Record<SpellType, SpellHandlerEntry> = {
  [SPELL_TYPES.SIGNATURE_DISH]: {
    execute: handleSignatureDish,
    validateTargets: validateSignatureDishTargets,
  },
  [SPELL_TYPES.WATER_GUN]: { execute: handleWaterGun, validateTargets: validateWaterGunTargets },
  [SPELL_TYPES.PREEMPTIVE_STRIKE]: { execute: handlePreemptiveStrike },
  [SPELL_TYPES.TEMP_STUN]: { execute: handleTempStun },
  [SPELL_TYPES.TEMP_BURST]: { execute: handleTempBurst },
  [SPELL_TYPES.TEMP_SLOW]: { execute: handleTempSlow },
  [SPELL_TYPES.BROTHERS_SHOULDER]: { execute: handleBrothersShoulder },
  [SPELL_TYPES.ALWAYS_AND_FOREVER]: { execute: handleAlwaysAndForever },
  [SPELL_TYPES.LOW_BLOW]: { execute: handleLowBlow },
  [SPELL_TYPES.BROTHERHOOD]: { execute: handleBrotherhood },
  [SPELL_TYPES.WILL_BLOOM_AGAIN]: { execute: handleWillBloomAgain },
  [SPELL_TYPES.PORTRAIT]: { execute: handlePortrait },
  [SPELL_TYPES.WARM_UP_THE_CROWD]: { execute: handleWarmUpTheCrowd },
  [SPELL_TYPES.SWIPER]: { execute: handleSwiper, payloadSchema: swiperOptionPayloadSchema },
  [SPELL_TYPES.MUTUAL_MATCH]: { execute: handleMutualMatch },
  [SPELL_TYPES.SWIPE_LEFT]: { execute: handleSwipeLeft },
  [SPELL_TYPES.SUPER_LIKE]: { execute: handleSuperLike },
}
