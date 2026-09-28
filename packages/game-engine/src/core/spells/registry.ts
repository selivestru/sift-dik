import { UNIT_KEYWORD } from '../../types'
import { SPELL_TYPES, type SpellHandler } from '../../types/spells.types'

export const SPELL_REGISTRY: Record<string, SpellHandler> = {
  [SPELL_TYPES.PREEMPTIVE_STRIKE]: (state, events, { spellItem }) => {
    const targetId = spellItem.targetUnitInstanceId
    if (!targetId) return

    const allUnits = [
      ...Object.values(state.players).flatMap((p) => p.board),
      ...(state.combat
        ? state.combat.slots.flatMap((s) => [s.attacker, s.blocker].filter(Boolean))
        : []),
    ]

    const target = allUnits.find((u) => u?.instanceId === targetId)

    if (!target) return

    target.health += 2
    target.maxHealth += 2
    target.tempHealth = (target.tempHealth ?? 0) + 2

    if (!target.keywords) {
      target.keywords = []
    }

    if (!target.keywords.includes(UNIT_KEYWORD.QUICK_ATTACK)) {
      target.keywords.push(UNIT_KEYWORD.QUICK_ATTACK)
      target.tempKeywords = [...(target.tempKeywords ?? []), UNIT_KEYWORD.QUICK_ATTACK]
    }
  },
}
