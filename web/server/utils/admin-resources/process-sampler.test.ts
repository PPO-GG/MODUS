import { describe, expect, it } from 'vitest'
import { createProcessSampler, eventLoopLagMs, type SamplerDeps } from './process-sampler'

function fakeDeps(uptime = 0) {
  const state = { now: 1_000_000, cpu: 0, uptime, lag: 0 }
  const deps: SamplerDeps = {
    now: () => state.now,
    cpuMicros: () => state.cpu,
    memory: () => ({ rss: 200, heapUsed: 80, heapTotal: 120 }),
    uptimeSeconds: () => state.uptime,
    readEventLoopP99Ms: () => state.lag,
  }
  return { state, deps }
}

describe('createProcessSampler (web)', () => {
  it('computes CPU over the real elapsed window', () => {
    const { state, deps } = fakeDeps()
    const sample = createProcessSampler(deps)
    state.now += 5_000
    state.cpu += 2_500_000
    expect(sample().cpuPercent).toBe(50)
  })

  it('first sample is the lifetime average', () => {
    const { state, deps } = fakeDeps(100)
    state.cpu = 20_000_000
    const sample = createProcessSampler(deps)
    expect(sample().cpuPercent).toBe(20)
  })

  it('returns 0 for a zero-length window without losing the delta', () => {
    const { state, deps } = fakeDeps()
    const sample = createProcessSampler(deps)
    state.cpu += 500_000
    expect(sample().cpuPercent).toBe(0)
    state.now += 1_000
    expect(sample().cpuPercent).toBe(50)
  })
})

describe('eventLoopLagMs', () => {
  it('subtracts the sampling resolution that monitorEventLoopDelay includes in every reading', () => {
    // An idle process reads ~resolution (+ timer granularity), not 0.
    expect(eventLoopLagMs(31_800_000, 20)).toBeCloseTo(11.8)
    expect(eventLoopLagMs(20_000_000, 20)).toBe(0)
  })

  it('never goes negative or non-finite', () => {
    expect(eventLoopLagMs(10_000_000, 20)).toBe(0)
    expect(eventLoopLagMs(Number.NaN, 20)).toBe(0)
    expect(eventLoopLagMs(Number.POSITIVE_INFINITY, 20)).toBe(0)
  })
})
