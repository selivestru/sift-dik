import type { RandomFn } from './random-fn'

export function shuffle<T>(array: T[], rng: RandomFn = Math.random): T[] {
  const result = structuredClone(array)

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))

    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }

  return result
}
