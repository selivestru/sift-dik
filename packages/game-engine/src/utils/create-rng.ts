import type { RandomFn } from './random-fn'

export interface RngState {
  rngState: number
}

export const createRng =
  (state: RngState): RandomFn =>
  () =>
    nextRandom(state)

export const nextRandom = (state: RngState): number => {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0
  const s = state.rngState
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
