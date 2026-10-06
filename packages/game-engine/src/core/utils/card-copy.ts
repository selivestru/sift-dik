import type { CardDefinition, CardInstance, GameState } from '../../types'

export const createCardCopy = (
  state: GameState,
  playerId: string,
  card: CardDefinition,
  overrides: Partial<CardDefinition> = {},
): CardInstance => {
  const existingIds = new Set<string>()

  for (const player of Object.values(state.players)) {
    for (const instance of [...player.hand, ...player.deck, ...player.board, ...player.graveyard]) {
      existingIds.add(instance.instanceId)
    }
  }

  for (const slot of state.combat?.slots ?? []) {
    existingIds.add(slot.attacker.instanceId)

    if (slot.blocker) {
      existingIds.add(slot.blocker.instanceId)
    }
  }
  for (const item of state.spellStack) {
    existingIds.add(item.spell.instanceId)
  }

  let index = 0

  while (existingIds.has(`${playerId}-copy-${index}`)) {
    index += 1
  }

  return {
    ...structuredClone(card),
    ...structuredClone(overrides),
    instanceId: `${playerId}-copy-${index}`,
    ownerId: playerId,
  } as CardInstance
}
