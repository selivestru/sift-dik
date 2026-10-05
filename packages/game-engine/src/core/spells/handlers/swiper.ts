import { z } from 'zod'

import type { GameEvent, GameState } from '../../../types'
import { SWIPER_OPTION, type SwiperOption } from '../../../types/abilities.types'
import type { SpellContext } from '../../../types/spells.types'
import { handleMutualMatch } from './mutual-match'
import { handleSuperLike } from './super-like'
import { handleSwipeLeft } from './swipe-left'

export const swiperOptionPayloadSchema = z.object({
  option: z.enum([SWIPER_OPTION.MUTUAL_MATCH, SWIPER_OPTION.SWIPE_LEFT, SWIPER_OPTION.SUPER_LIKE]),
})

export const handleSwiper = (
  state: GameState,
  events: GameEvent[],
  { spellItem, payload }: SpellContext,
): void => {
  const option = payload?.option as SwiperOption | undefined

  if (!option) {
    throw new Error('Swiper requires a chosen option')
  }

  switch (option) {
    case SWIPER_OPTION.MUTUAL_MATCH:
      handleMutualMatch(state, events, { spellItem, payload })
      break
    case SWIPER_OPTION.SWIPE_LEFT:
      handleSwipeLeft(state, events, { spellItem, payload })
      break
    case SWIPER_OPTION.SUPER_LIKE:
      handleSuperLike(state, events, { spellItem, payload })
      break
  }
}
