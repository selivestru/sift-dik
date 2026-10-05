import { z } from 'zod'

import { swiperCard } from '../../../catalog/spells/swiper'
import type { GameEvent, GameState, SpellCardInstance, StackSpell } from '../../../types'
import type { LeonSwipeAbilityContext } from '../../../types/abilities.types'
import { SWIPER_OPTION } from '../../../types/abilities.types'
import { resolveSpellItem } from '../../spells/resolve-spell-stack'
import { createCardCopy } from '../../utils/card-copy'

export const leonSwipePayloadSchema = z.object({
  option: z.enum([SWIPER_OPTION.MUTUAL_MATCH, SWIPER_OPTION.SWIPE_LEFT, SWIPER_OPTION.SUPER_LIKE]),
})

export const handleLeonSwipe = (
  state: GameState,
  events: GameEvent[],
  context: LeonSwipeAbilityContext,
): void => {
  const swiper = createCardCopy(state, context.sourceUnit.ownerId, swiperCard) as SpellCardInstance

  const spellItem: StackSpell = {
    spell: swiper,
    payload: { option: context.option },
  }

  resolveSpellItem(state, events, spellItem)
}
