import type { GameEvent, GameState, StackSpell } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { findLiveUnit } from '../../utils/find-unit'
import { fullyHealUnit } from '../../utils/heal-unit'

export const validateSignatureDishTargets = (state: GameState, spellItem: StackSpell): void => {
  if (spellItem.targets?.length !== 1) {
    throw new Error('Signature Dish requires exactly one allied unit target')
  }

  const target = findLiveUnit(state, spellItem.targets[0]!)

  if (!target || target.ownerId !== spellItem.spell.ownerId) {
    throw new Error('Signature Dish can only target your own live ally')
  }
}

export const handleSignatureDish = (
  state: GameState,
  events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const target = findLiveUnit(state, spellItem.targets?.[0] ?? '')

  if (!target || target.ownerId !== spellItem.spell.ownerId) return

  fullyHealUnit(target, events)
}
