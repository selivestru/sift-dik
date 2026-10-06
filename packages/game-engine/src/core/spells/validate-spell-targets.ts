import type { GameState, StackSpell } from '../../types'
import { SPELL_TYPES, type SpellType } from '../../types/spells.types'
import { findLiveUnit } from '../utils/find-unit'

type TargetKind = 'ally' | 'enemy' | 'hand'

const targetKinds: Partial<Record<SpellType, TargetKind[]>> = {
  [SPELL_TYPES.PREEMPTIVE_STRIKE]: ['ally'],
  [SPELL_TYPES.TEMP_STUN]: ['enemy'],
  [SPELL_TYPES.TEMP_BURST]: ['ally'],
  [SPELL_TYPES.TEMP_SLOW]: ['ally'],
  [SPELL_TYPES.BROTHERS_SHOULDER]: ['ally', 'ally'],
  [SPELL_TYPES.ALWAYS_AND_FOREVER]: ['ally'],
  [SPELL_TYPES.LOW_BLOW]: ['enemy'],
  [SPELL_TYPES.WILL_BLOOM_AGAIN]: ['ally'],
  [SPELL_TYPES.PORTRAIT]: ['hand'],
}

export const validateSpellTargets = (state: GameState, item: StackSpell): void => {
  const kinds = targetKinds[item.spell.id] ?? []
  const targets = item.targets ?? []
  if (kinds.length !== targets.length) {
    throw new Error(`Spell "${item.spell.id}" requires exactly ${kinds.length} targets`)
  }
  for (const [index, kind] of kinds.entries()) {
    const targetId = targets[index]!
    if (kind === 'hand') {
      if (!state.players[item.spell.ownerId]!.hand.some((card) => card.instanceId === targetId && card.instanceId !== item.spell.instanceId)) {
        throw new Error('Target must be another card in your hand')
      }
      continue
    }
    const target = findLiveUnit(state, targetId)
    const isAlly = target?.ownerId === item.spell.ownerId
    if (!target || (kind === 'ally' ? !isAlly : isAlly)) {
      throw new Error(`Target must be a live ${kind} unit`)
    }
  }
}
