export type MetricName =
  | 'roomsCreated'
  | 'roomsJoined'
  | 'actionsAccepted'
  | 'actionsRejected'
  | 'roundsStarted'
  | 'roundsCompleted'
  | 'clientErrors'
  | 'serverErrors'

export interface MetricsSnapshot {
  startedAt: string
  uptimeSeconds: number
  roomsCreated: number
  roomsJoined: number
  actionsAccepted: number
  actionsRejected: number
  roundsStarted: number
  roundsCompleted: number
  clientErrors: number
  serverErrors: number
}

type TelemetryStore = {
  startedAt: number
  counters: Record<MetricName, number>
}

const globalStore = globalThis as unknown as { __thinnaiTelemetry?: TelemetryStore }
const STORE: TelemetryStore = (globalStore.__thinnaiTelemetry ??= {
  startedAt: Date.now(),
  counters: {
    roomsCreated: 0,
    roomsJoined: 0,
    actionsAccepted: 0,
    actionsRejected: 0,
    roundsStarted: 0,
    roundsCompleted: 0,
    clientErrors: 0,
    serverErrors: 0,
  },
})

export function recordMetric(name: MetricName, detail?: Record<string, string | number | boolean>) {
  STORE.counters[name] += 1
  if (process.env.NODE_ENV !== 'test') {
    console.info(JSON.stringify({
      event: name,
      at: new Date().toISOString(),
      ...detail,
    }))
  }
}

export function metricsSnapshot(): MetricsSnapshot {
  return {
    startedAt: new Date(STORE.startedAt).toISOString(),
    uptimeSeconds: Math.floor((Date.now() - STORE.startedAt) / 1000),
    ...STORE.counters,
  }
}
