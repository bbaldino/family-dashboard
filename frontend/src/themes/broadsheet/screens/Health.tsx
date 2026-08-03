import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { useNow } from '@/themes/broadsheet/home/useNow'
import {
  useHealthServices,
  useServiceUptime,
  useIncidents,
  summarizeHealth,
  formatDuration,
  formatIncidentWhen,
  isOngoing,
  REFRESH_MS,
  type Incident,
  type Service,
  type Status,
  type ServiceUptime,
} from '@/data/health'

/** Mock `health.jsx`'s `HL_STATUS`, mapped onto broadsheet's own tokens rather
 *  than its private hexes: forest for ok, the secondary ochre for degraded,
 *  rust for critical, muted ink for unknown. */
const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--forest)',
  degraded: '#8a6321',
  critical: 'var(--rust)',
  unknown: 'var(--ink-muted)',
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  degraded: 'DEGRADED',
  critical: 'CRITICAL',
  unknown: 'UNKNOWN',
}

function bucketOf(status: Status): string {
  if (status === 'ok' || status === 'degraded' || status === 'critical') return status
  return 'unknown'
}

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.14em',
  color: 'var(--ink-muted)',
} as const

const screenTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 24,
  fontWeight: 400,
  color: 'color-mix(in srgb, var(--paper) 12%, var(--ink) 88%)',
}

/** Mock `health.jsx`'s `UptimeBar` — 48 half-hour blocks, hairline gaps. `ok`
 *  is held at 55% opacity so a healthy run reads as texture and anything wrong
 *  reads as a mark. */
function UptimeBar({ blocks, height }: { blocks: Status[]; height: number }) {
  return (
    <div style={{ display: 'flex', gap: 1, height, alignItems: 'stretch' }}>
      {blocks.map((s, i) => {
        const bucket = bucketOf(s)
        return (
          <div
            key={i}
            style={{
              flex: 1,
              background: bucket === 'unknown' ? 'var(--rule-faint)' : STATUS_COLOR[bucket],
              opacity: bucket === 'ok' ? 0.55 : 1,
            }}
          />
        )
      })}
    </div>
  )
}

function MonitorRow({ service, uptime }: { service: Service; uptime: ServiceUptime }) {
  const bucket = bucketOf(service.status)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr 96px',
        gap: 12,
        padding: '13px 0',
        borderTop: '1px dotted var(--rule-faint)',
        alignItems: 'start',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          background: STATUS_COLOR[bucket],
          marginTop: 8,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {service.name}
          </span>
          <span style={{ ...monoStyle, fontSize: 9, textTransform: 'uppercase' }}>
            {service.type_id}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 13.5,
            color: 'var(--ink-muted)',
            marginTop: 1,
          }}
        >
          {service.message ?? '—'}
        </div>
        <div style={{ marginTop: 7 }}>
          <UptimeBar blocks={uptime.blocks} height={18} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {/* The mock shows a response time here. Nothing in `/api/health/status`
         *  reports latency, so the slot carries the uptime figure alone rather
         *  than a number we'd have to invent. */}
        <div style={{ ...monoStyle, fontSize: 11, color: 'var(--ink)', letterSpacing: '0.04em' }}>
          {uptime.percentOk === null ? '—' : `${uptime.percentOk.toFixed(2)}%`}
        </div>
        <div style={{ ...monoStyle, fontSize: 9, letterSpacing: '0.12em', marginTop: 2 }}>24H</div>
      </div>
    </div>
  )
}

/** The mock promotes a fault to a lead story above the board. */
function LeadStory({
  service,
  uptime,
  incident,
}: {
  service: Service
  uptime: ServiceUptime
  incident: Incident | null
}) {
  const bucket = bucketOf(service.status)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 28,
        paddingBottom: 14,
        marginBottom: 4,
        borderBottom: '3px double var(--ink)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
          <span className="doorbell-ring-pulse" style={{ background: STATUS_COLOR[bucket] }} />
          <span
            style={{
              ...monoStyle,
              fontSize: 10,
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: STATUS_COLOR[bucket],
              fontWeight: 700,
            }}
          >
            {STATUS_LABEL[bucket]} · {service.type_id}
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--rule-faint)' }} />
          {/* The mock's "SINCE 11:48 AM · 3H 08M". Read, not inferred: an
           *  ongoing incident carries its true start even when that predates
           *  the inline 24h window, so a long outage can't under-report. */}
          {incident && (
            <span style={{ ...monoStyle, fontSize: 10, letterSpacing: '0.12em' }}>
              SINCE{' '}
              {new Date(incident.started_at * 1000)
                .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                .toUpperCase()}{' '}
              · {formatDuration(incident.duration_secs).toUpperCase()}
            </span>
          )}
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          {service.name} — {service.message ?? 'not answering'}.
        </h2>
        {service.components.length > 0 && (
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--ink-muted)',
              lineHeight: 1.45,
              maxWidth: 720,
              margin: 0,
            }}
          >
            {service.components
              .filter((c) => bucketOf(c.status) !== 'ok')
              .map((c) => `${c.name}: ${c.message ?? c.status}`)
              .join(' · ') || 'All components reporting normally.'}
          </p>
        )}
      </div>
      <div>
        <div
          style={{ ...monoStyle, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 5 }}
        >
          Last 24 hours
        </div>
        <UptimeBar blocks={uptime.blocks} height={44} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
            ...monoStyle,
            fontSize: 9,
            letterSpacing: '0.1em',
          }}
        >
          <span>YESTERDAY</span>
          <span>NOW</span>
        </div>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule-faint)' }}>
          <div style={{ ...monoStyle, fontSize: 9, letterSpacing: '0.18em' }}>UPTIME</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            {uptime.percentOk === null ? '—' : `${uptime.percentOk.toFixed(2)}%`}
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * The ledger — the band the quiet state would otherwise leave empty.
 *
 * Rows are whole incidents from homelab-health, already grouped: one row per
 * outage rather than per failed poll. Two of its rules come straight from that
 * API's shape. An incident is returned whole, so a row can have begun before
 * the seven-day window and `formatIncidentWhen` dates those rather than naming
 * a weekday that would land a week wrong. And `failing_components: []` is
 * ambiguous — no components, or detail pruned past the 7-day retention — so it
 * is never rendered as "nothing was wrong"; the rollup message carries the row.
 */
function Ledger({
  incidents,
  rows,
  failed,
}: {
  incidents: Incident[]
  rows: number
  failed: boolean
}) {
  const shown = incidents.slice(0, rows)

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '2px solid var(--ink)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            ...monoStyle,
            fontSize: 10,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--rust)',
          }}
        >
          The ledger
        </span>
        <span style={{ ...monoStyle, fontSize: 10, letterSpacing: '0.12em' }}>
          LAST SEVEN DAYS
        </span>
      </div>

      {failed ? (
        /* A failed request is not a clean week. The two were indistinguishable
         * while the endpoint answered 400s with a body we parsed as data; they
         * must never look alike here either. */
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--rust)',
            margin: '6px 0 0',
          }}
        >
          The ledger is unavailable — the wire is down, not quiet.
        </p>
      ) : shown.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink-muted)',
            margin: '6px 0 0',
          }}
        >
          No incidents this week.
        </p>
      ) : (
        shown.map((incident) => {
          const bucket = bucketOf(incident.worst_status)
          return (
            <div
              key={`${incident.monitor_id}-${incident.started_at}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '104px 150px 1fr 72px',
                gap: 14,
                padding: '6px 0',
                borderTop: '1px dotted var(--rule-faint)',
                alignItems: 'baseline',
              }}
            >
              <span style={{ ...monoStyle, fontSize: 10, letterSpacing: '0.1em' }}>
                {formatIncidentWhen(incident)}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {incident.monitor_name}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 13.5,
                  color: 'var(--ink-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={incident.message ?? undefined}
              >
                {incident.message ?? '—'}
              </span>
              <span
                style={{
                  ...monoStyle,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textAlign: 'right',
                  color: STATUS_COLOR[bucket],
                }}
              >
                {isOngoing(incident) ? 'ONGOING' : formatDuration(incident.duration_secs)}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

/**
 * The Wire — broadsheet's service health board. Mock:
 * `docs/superpowers/designs/broadsheet/health.jsx`, with `health-fault.html`
 * for the state where something is wrong.
 *
 * Three things the mock shows are absent here, all for want of data rather
 * than taste:
 *
 *  - **Response time per row.** `/api/health/status` carries no latency field,
 *    so that slot holds the 24h uptime figure by itself.
 *  - **The lead story's actions** (Retry now / Open logs / Silence 1h). No
 *    endpoint backs any of them; buttons that don't work are worse than none.
 *  - **The seven-day incident ledger.** The API can report one service's
 *    history, but not a cross-service ledger — that's the data currently being
 *    added on the health-server side. The band it occupies is left to the board
 *    until then, rather than filled with a placeholder.
 */
export function Health() {
  const now = useNow()
  const { data: services = [], isLoading } = useHealthServices()
  const uptimeById = useServiceUptime(services)
  const { data: incidents = [], isError: ledgerFailed } = useIncidents()

  const summary = summarizeHealth(services)
  const lead = summary.faults[0] ?? null
  const rest = lead ? services.filter((s) => s.id !== lead.id) : services
  const half = Math.ceil(rest.length / 2)
  const columns = [rest.slice(0, half), rest.slice(half)]

  const emptyUptime: ServiceUptime = { blocks: [], percentOk: null }

  return (
    <div
      data-testid="broadsheet-health"
      className="broadsheet-root w-[1600px] h-[900px] flex flex-col"
    >
      <MastheadFrame
        left={
          <>
            <div style={mastheadKickerStyle}>Section VI</div>
            <div style={screenTitleStyle}>The Wire</div>
          </>
        }
        center={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>
              Homelab · {services.length} monitors
            </div>
            <h1 className="m-0" style={mastheadNumeralStyle}>
              {isLoading ? 'Listening…' : summary.headline}
            </h1>
          </>
        }
        right={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>Wire copy</div>
            <div style={{ ...monoStyle, fontSize: 11, color: 'var(--ink)', textAlign: 'right' }}>
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ ...monoStyle, fontSize: 9, textAlign: 'right', marginTop: 2 }}>
              REFRESHING EVERY {Math.round(REFRESH_MS / 1000)}s
            </div>
          </>
        }
      />

      {/* Tally and standfirst */}
      <div
        style={{
          padding: '10px 56px 12px',
          borderBottom: '1px solid var(--rule-faint)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 22,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {(['ok', 'degraded', 'critical', 'unknown'] as const).map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 7,
                  background: STATUS_COLOR[k],
                  alignSelf: 'center',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: summary.counts[k] > 0 ? 'var(--ink)' : 'var(--ink-muted)',
                }}
              >
                {summary.counts[k]}
              </span>
              <span style={{ ...monoStyle, fontSize: 9, letterSpacing: '0.16em' }}>
                {STATUS_LABEL[k]}
              </span>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 15.5,
            lineHeight: 1.4,
            margin: 0,
            textAlign: 'center',
          }}
        >
          {summary.standfirst} <span style={{ color: 'var(--ink-muted)' }}>— the house.</span>
        </p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: '16px 56px 0' }}>
        {lead && (
          <LeadStory
            service={lead}
            uptime={uptimeById[lead.id] ?? emptyUptime}
            // The service's own ongoing incident, inline in the status payload —
            // no second request for the lead story's "since" line.
            incident={(lead.recent_incidents ?? []).find(isOngoing) ?? null}
          />
        )}

        {/* The board takes the slack and the ledger is pinned: without this the
         *  two together overrun the body box and the last ledger row slides
         *  under the footer, which reserves its 64px but does not clip. Losing
         *  the bottom of a board column is visible; a ledger row vanishing
         *  under the music player is not. */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 6,
              flex: '0 0 auto',
            }}
          >
            <span
              style={{
                ...monoStyle,
                fontSize: 10,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: lead ? 'var(--ink-muted)' : 'var(--rust)',
              }}
            >
              {lead ? 'Everything else' : 'The board'}
            </span>
            <span style={{ ...monoStyle, fontSize: 10, letterSpacing: '0.12em' }}>
              {rest.length} monitors
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 34,
              alignContent: 'start',
              flex: '1 1 0',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {columns.map((column, i) => (
              <div key={i} style={{ borderTop: '2px solid var(--ink)' }}>
                {column.map((service) => (
                  <MonitorRow
                    key={service.id}
                    service={service}
                    uptime={uptimeById[service.id] ?? emptyUptime}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Trimmed when a lead story is already competing for the height —
           *  the mock does the same. */}
          <div style={{ flex: '0 0 auto' }}>
            <Ledger incidents={incidents} rows={lead ? 2 : 6} failed={ledgerFailed} />
          </div>
        </div>
      </div>

      {/* Reserves the 64px the footer occupies (`BroadsheetLayout`). */}
      <div style={{ height: 64, flex: '0 0 auto' }} />
    </div>
  )
}
