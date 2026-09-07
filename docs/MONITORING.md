# Monitoring

## Health and usage metrics

The app exposes a lightweight monitoring endpoint:

```bash
curl https://YOUR_HOST/api/health
```

It returns process uptime and counters for:

- rooms created and joined
- accepted and rejected actions
- rounds started and completed
- client errors
- server errors

For a public deployment, set `MONITORING_TOKEN` and call it with:

```bash
curl -H "Authorization: Bearer $MONITORING_TOKEN" https://YOUR_HOST/api/health
```

Without `MONITORING_TOKEN`, the endpoint is intentionally open for a private/demo
server. Set the variable for a live deployment.

## Structured logs

Server events are emitted as one-line JSON through stdout. Render, Railway, Docker,
and most hosting providers collect stdout automatically. Events include an event name,
time, and safe context such as action type and table size. Secrets, hands, card ids,
and trump cards are not logged.

Recommended first dashboard counters:

- `roomsCreated`
- `roomsJoined`
- `actionsRejected`
- `roundsCompleted`
- `clientErrors`
- `serverErrors`

## Client crashes

`app/error.tsx` reports a sanitized error message and optional Next.js digest to
`POST /api/telemetry`. It does not send player hands, secrets, or card data.

## Limitations

These counters are process-local. They reset when the Node process restarts and are
not aggregated across multiple instances. For permanent monitoring, forward the JSON
stdout events to a log service and replace the in-memory counters with Redis or a
metrics provider. The health endpoint is an immediate operational check, not a
long-term analytics database.
