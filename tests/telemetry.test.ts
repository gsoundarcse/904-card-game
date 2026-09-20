import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { metricsSnapshot, recordMetric } from '@/lib/server/telemetry'

describe('telemetry', () => {
  it('increments the named counter and leaves the others untouched', () => {
    const before = metricsSnapshot()
    recordMetric('roomsCreated', { seatCount: 4 })
    const after = metricsSnapshot()
    assert.equal(after.roomsCreated, before.roomsCreated + 1)
    assert.equal(after.roomsJoined, before.roomsJoined, 'an unrelated counter must not move')
  })

  it('reports a non-negative, growing uptime and a stable startedAt', () => {
    const a = metricsSnapshot()
    const b = metricsSnapshot()
    assert.equal(a.startedAt, b.startedAt, 'the process start time does not change between snapshots')
    assert.ok(b.uptimeSeconds >= a.uptimeSeconds, 'uptime never goes backwards')
    assert.ok(a.uptimeSeconds >= 0)
  })

  it('keeps a capped, newest-first ring buffer of client error messages', () => {
    for (let i = 0; i < 25; i++) {
      recordMetric('clientErrors', { message: `boom-${i}` })
    }
    const snapshot = metricsSnapshot()
    assert.ok(snapshot.recentClientErrors.length <= 20, 'ring buffer is capped at 20 entries')
    assert.equal(snapshot.recentClientErrors[0].message, 'boom-24', 'the most recent error is first')
  })

  it('keeps client and server error buffers independent', () => {
    const before = metricsSnapshot()
    recordMetric('serverErrors', { message: 'server-side-only' })
    const after = metricsSnapshot()
    assert.equal(after.serverErrors, before.serverErrors + 1)
    assert.equal(after.recentServerErrors[0].message, 'server-side-only')
    assert.equal(after.clientErrors, before.clientErrors, 'recording a server error does not touch client counters')
  })
})
