export const createRng = (seed: number) => {
  const state = { randomState: seed >>> 0 }
  return (): number => nextRandom(state)
}

export const nextRandom = (state: { randomState: number }): number => {
  state.randomState = (state.randomState + 0x6d2b79f5) >>> 0
  const s = state.randomState
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
