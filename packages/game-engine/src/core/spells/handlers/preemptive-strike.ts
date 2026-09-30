import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'

export const handlePreemptiveStrike = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
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

  target.health += 1
  target.maxHealth += 1
  target.tempHealth = (target.tempHealth ?? 0) + 1

  target.attack += 2
  target.tempAttack = (target.tempAttack ?? 0) + 2

  if (!target.keywords) {
    target.keywords = []
  }

  if (!target.tempKeywords) {
    target.tempKeywords = []
  }

  if (!target.keywords.includes(KEYWORD.QUICK_ATTACK)) {
    target.keywords.push(KEYWORD.QUICK_ATTACK)
    target.tempKeywords.push(KEYWORD.QUICK_ATTACK)
  }
}
