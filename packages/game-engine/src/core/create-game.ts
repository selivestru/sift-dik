import { MAX_REPUTATION } from '../constants/game'
import type { CardDefinition, CardInstance, GameState } from '../types'
import { nextRandom } from '../utils/createRng'
import { randomItem } from '../utils/randomItem'
import { shuffle } from '../utils/shuffle'

export interface CreateGamePlayer {
  id: string
  cards: CardDefinition[]
}

export interface CreateGameOptions {
  seed?: number
}

export const createGame = (
  players: [CreateGamePlayer, CreateGamePlayer],
  options?: CreateGameOptions,
): GameState => {
  const random = { randomState: (options?.seed ?? 0) >>> 0 }
  const rng = () => nextRandom(random)

  if (
    players.length !== 2 ||
    players.some((player) => !player.id) ||
    players[0].id === players[1].id
  ) {
    throw new Error('A game requires two distinct nonempty player IDs')
  }

  if (players.some((player) => player.cards.length < 4)) {
    throw new Error('Each deck must contain at least four cards')
  }

  if (
    options?.seed !== undefined &&
    (!Number.isInteger(options.seed) || !Number.isFinite(options.seed))
  ) {
    throw new Error('Game seed must be a finite integer')
  }

  const initiativePlayer = randomItem(players, rng)

  const gameState: GameState = {
    phase: 'mulligan',
    randomState: random.randomState,
    mulligan: Object.fromEntries(players.map((player) => [player.id, null])),
    players: Object.create(null),
    round: 0,
    initiativePlayerId: initiativePlayer.id,
    turnPlayerId: initiativePlayer.id,
    combat: null,
    spellStack: [],
    stackInitiatorPlayerId: null,
    winnerPlayerId: null,
    isDraw: false,
    consecutivePasses: 0,
  }

  for (const player of players) {
    const cardInstances: CardInstance[] = player.cards.map((card, index) => ({
      ...structuredClone(card),
      instanceId: `${player.id}-card-${index + 1}`,
      ownerId: player.id,
    }))

    const deckCards = shuffle(cardInstances, rng)
    const handCards = deckCards.splice(0, 4)

    gameState.players[player.id] = {
      id: player.id,
      reputation: MAX_REPUTATION,
      maxEnergy: 0,
      energy: 0,
      reservedEnergy: 0,
      deck: deckCards,
      hand: handCards,
      board: [],
      graveyard: [],
      hasAttackToken: false,
    }
  }

  gameState.randomState = random.randomState

  return gameState
}
