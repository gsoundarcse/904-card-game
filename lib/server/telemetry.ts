export type MetricName =
  | 'roomsCreated'
  | 'roomsJoined'
  | 'actionsAccepted'
  | 'actionsRejected'
  | 'roundsStarted'
  | 'roundsCompleted'
  | 'clientErrors'
  | 'serverErrors'

export interface RecentError {
  at: string
  message: string
  digest?: string
}

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
  recentClientErrors: RecentError[]
  recentServerErrors: RecentError[]
}

type TelemetryStore = {
  startedAt: number
  counters: Record<MetricName, number>
  recentClientErrors: RecentError[]
  recentServerErrors: RecentError[]
}

const RECENT_ERRORS_LIMIT = 20

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
  recentClientErrors: [],
  recentServerErrors: [],
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
  if (name === 'clientErrors' || name === 'serverErrors') {
    const bucket = name === 'clientErrors' ? STORE.recentClientErrors : STORE.recentServerErrors
    bucket.unshift({
      at: new Date().toISOString(),
      message: typeof detail?.message === 'string' ? detail.message : name,
      digest: typeof detail?.digest === 'string' ? detail.digest : undefined,
    })
    bucket.length = Math.min(bucket.length, RECENT_ERRORS_LIMIT)
  }
}

export function metricsSnapshot(): MetricsSnapshot {
  return {
    startedAt: new Date(STORE.startedAt).toISOString(),
    uptimeSeconds: Math.floor((Date.now() - STORE.startedAt) / 1000),
    ...STORE.counters,
    recentClientErrors: STORE.recentClientErrors,
    recentServerErrors: STORE.recentServerErrors,
  }
}
