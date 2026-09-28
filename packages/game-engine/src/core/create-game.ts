import { INIT_ENERGY, MAX_REPUTATION } from '../constants/game'
import type { CardDefinition, CardInstance, GameState } from '../types'
import { createRng } from '../utils/createRng'
import { randomItem } from '../utils/randomItem'
import { shuffle } from '../utils/shuffle'

interface CreateGamePlayer {
  id: string
  cards: CardDefinition[]
}

interface CreateGameOptions {
  seed?: number
}

export const createGame = (
  players: [CreateGamePlayer, CreateGamePlayer],
  options?: CreateGameOptions,
): GameState => {
  const rng = options?.seed ? createRng(options?.seed) : undefined
  const initiativePlayer = randomItem(players, rng)

  const gameState: GameState = {
    players: {},
    round: 1,
    initiativePlayerId: initiativePlayer.id,
    turnPlayerId: initiativePlayer.id,
    combat: null,
    spellStack: [],
    winnerPlayerId: null,
    consecutivePasses: 0,
  }

  for (const player of players) {
    const cardInstances: CardInstance[] = player.cards.map((card, index) => ({
      ...card,
      instanceId: `${player.id}-card-${index + 1}`,
      ownerId: player.id,
    }))

    const deckCards = shuffle(cardInstances, rng)
    const handCards = deckCards.splice(0, 4)

    gameState.players[player.id] = {
      id: player.id,
      reputation: MAX_REPUTATION,
      maxEnergy: INIT_ENERGY,
      energy: INIT_ENERGY,
      reservedEnergy: 0,
      deck: deckCards,
      hand: handCards,
      board: [],
      graveyard: [],
      hasAttackToken: gameState.initiativePlayerId === player.id,
    }
  }

  return gameState
}
