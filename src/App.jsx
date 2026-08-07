import { useEffect, useMemo, useState } from 'react';

const fallbackReport = {
  generatedAt: '2026-08-07T00:00:00.000Z',
  nextRunAt: '2026-08-08T02:40:00.000Z',
  project: {
    name: 'Swift Go Delivery Service',
    description:
      'Dispatch Pulse monitors delivery endpoints, records uptime snapshots, and publishes the results for the operations team.',
    cadence: 'Daily at 02:40 UTC',
    output: 'public/runtime/health.json',
  },
  summary: {
    total: 4,
    healthy: 4,
    degraded: 0,
    averageLatencyMs: 128,
    successRate: 100,
  },
  routeMetrics: [
    {
      route: 'core',
      label: 'Core',
      total: 2,
      healthy: 2,
      degraded: 0,
      averageLatencyMs: 101,
      successRate: 100,
    },
    {
      route: 'integrations',
      label: 'Integrations',
      total: 1,
      healthy: 1,
      degraded: 0,
      averageLatencyMs: 154,
      successRate: 100,
    },
    {
      route: 'docs',
      label: 'Docs',
      total: 1,
      healthy: 1,
      degraded: 0,
      averageLatencyMs: 158,
      successRate: 100,
    },
  ],
  alerts: [
    {
      id: 'overall-success-rate',
      label: 'Overall success rate',
      scope: 'summary',
      metric: 'successRate',
      operator: 'lt',
      threshold: 95,
      severity: 'high',
      value: 100,
      triggered: false,
      status: 'ok',
    },
    {
      id: 'core-latency',
      label: 'Core latency',
      scope: 'route',
      route: 'core',
      metric: 'averageLatencyMs',
      operator: 'gt',
      threshold: 800,
      severity: 'medium',
      value: 101,
      triggered: false,
      status: 'ok',
    },
  ],
  history: [
    {
      generatedAt: '2026-08-07T00:00:00.000Z',
      healthy: 4,
      total: 4,
      degraded: 0,
      averageLatencyMs: 128,
      successRate: 100,
      routeMetrics: [],
      alerts: [],
    },
  ],
  checks: [
    {
      name: 'Order intake API',
      category: 'Core',
      url: 'https://example.com',
      expectedStatus: 200,
      status: 200,
      ok: true,
      latencyMs: 112,
      checkedAt: '2026-08-07T00:00:00.000Z',
      note: 'Landing endpoint reachable',
    },
    {
      name: 'Dispatch webhook relay',
      category: 'Integrations',
      url: 'https://api.github.com',
      expectedStatus: 200,
      status: 200,
      ok: true,
      latencyMs: 154,
      checkedAt: '2026-08-07T00:00:00.000Z',
      note: 'External API responded normally',
    },
    {
      name: 'Maps availability',
      category: 'Dependencies',
      url: 'https://www.google.com/generate_204',
      expectedStatus: 204,
      status: 204,
      ok: true,
      latencyMs: 89,
      checkedAt: '2026-08-07T00:00:00.000Z',
      note: 'Fast no-content check',
    },
    {
      name: 'Docs host',
      category: 'Docs',
      url: 'https://vite.dev',
      expectedStatus: 200,
      status: 200,
      ok: true,
      latencyMs: 158,
      checkedAt: '2026-08-07T00:00:00.000Z',
      note: 'Reference documentation available',
    },
  ],
  notes: [
    'The cron workflow runs the report generator on schedule and commits the generated snapshot.',
    'Local developers can refresh the dashboard data with npm run report.',
  ],
};

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function buildHistoryPath(points, width, height, padding) {
  if (!points.length) {
    return '';
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const range = maxValue - minValue || 1;

  return points
    .map((value, index) => {
      const x = padding + (innerWidth * index) / Math.max(points.length - 1, 1);
      const y = padding + innerHeight - ((value - minValue) / range) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function App() {
  const [report, setReport] = useState(fallbackReport);
  const [banner, setBanner] = useState('Loading the latest dispatch snapshot...');

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const response = await fetch('/runtime/health.json', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Unexpected response: ${response.status}`);
        }

        const payload = await response.json();

        if (!cancelled) {
          setReport(payload);
          setBanner('Live snapshot loaded from public/runtime/health.json.');
        }
      } catch {
        if (!cancelled) {
          setBanner('Using the bundled fallback snapshot until the next cron run publishes fresh data.');
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, []);

  const checks = useMemo(
    () => (Array.isArray(report.checks) ? report.checks : []),
    [report]
  );

  const routeMetrics = useMemo(
    () => (Array.isArray(report.routeMetrics) ? report.routeMetrics : []),
    [report]
  );

  const alerts = useMemo(() => (Array.isArray(report.alerts) ? report.alerts : []), [report]);

  const history = useMemo(() => (Array.isArray(report.history) ? report.history : []), [report]);

  const metrics = useMemo(() => {
    const healthy = checks.filter((check) => check.ok).length;
    const degraded = Math.max(checks.length - healthy, 0);
    const averageLatencyMs =
      checks.length === 0
        ? 0
        : Math.round(
            checks.reduce((sum, check) => sum + Number(check.latencyMs || 0), 0) /
              checks.length
          );

    const successRate = checks.length === 0 ? 0 : (healthy / checks.length) * 100;

    return {
      healthy,
      degraded,
      averageLatencyMs,
      successRate,
      total: checks.length,
    };
  }, [checks]);

  const historyPoints = history.map((entry) => entry.successRate ?? 0);
  const historyPath = buildHistoryPath(historyPoints, 1000, 240, 24);
  const latestAlerts = alerts.filter((alert) => alert.triggered);

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <div className="eyebrow">Cron-backed delivery automation</div>
          <h1>{report.project?.name || 'Swift Go Delivery Service'}</h1>
          <p className="hero-description">{report.project?.description}</p>

          <div className="hero-meta">
            <span className="meta-chip">{report.project?.cadence}</span>
            <span className="meta-chip">Output: {report.project?.output}</span>
            <span className="meta-chip">Generated {formatDateTime(report.generatedAt)}</span>
          </div>
        </div>

        <div className="hero-status">
          <span className="status-label">Pipeline state</span>
          <strong>{banner}</strong>
          <div className="status-grid">
            <div>
              <span>Next run</span>
              <strong>{formatDateTime(report.nextRunAt)}</strong>
            </div>
            <div>
              <span>Success rate</span>
              <strong>{formatPercent(metrics.successRate)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card panel">
          <span>Healthy checks</span>
          <strong>{metrics.healthy}/{metrics.total}</strong>
          <p>Endpoints that returned the expected response code.</p>
        </article>
        <article className="metric-card panel">
          <span>Degraded checks</span>
          <strong>{metrics.degraded}</strong>
          <p>Targets that need attention before the next dispatch window.</p>
        </article>
        <article className="metric-card panel">
          <span>Average latency</span>
          <strong>{metrics.averageLatencyMs} ms</strong>
          <p>Mean response time across the latest scheduled run.</p>
        </article>
        <article className="metric-card panel">
          <span>Cadence</span>
          <strong>{report.project?.cadence}</strong>
          <p>Scheduled by GitHub Actions and mirrored in the local report command.</p>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel checks-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Latest run</span>
              <h2>Endpoint health snapshot</h2>
            </div>
            <span className="meta-chip subtle">{checks.length} monitored targets</span>
          </div>

          <div className="checks-list">
            {checks.map((check) => (
              <div className="check-row" key={`${check.name}-${check.url}`}>
                <div className="check-main">
                  <span className={`status-dot ${check.ok ? 'ok' : 'bad'}`} />
                  <div>
                    <strong>{check.name}</strong>
                    <p>
                      {check.category} · Expected {check.expectedStatus} · {check.url}
                    </p>
                  </div>
                </div>

                <div className="check-stats">
                  <span className={`status-pill ${check.ok ? 'ok' : 'bad'}`}>
                    {check.status}
                  </span>
                  <strong>{check.latencyMs} ms</strong>
                  <small>{check.note}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="sidebar-stack">
          <article className="panel route-panel">
            <span className="section-kicker">Per-route metrics</span>
            <h2>Route performance</h2>
            <div className="route-grid">
              {routeMetrics.map((route) => (
                <div className="route-card" key={route.route}>
                  <div className="route-header">
                    <strong>{route.label}</strong>
                    <span>{formatPercent(route.successRate)}</span>
                  </div>
                  <div className="route-bar">
                    <span style={{ width: `${route.successRate}%` }} />
                  </div>
                  <dl>
                    <div>
                      <dt>Checks</dt>
                      <dd>{route.total}</dd>
                    </div>
                    <div>
                      <dt>Latency</dt>
                      <dd>{route.averageLatencyMs} ms</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </article>

          <article className="panel timeline-panel">
            <span className="section-kicker">Automation flow</span>
            <h2>How the cron job works</h2>
            <ol>
              <li>Read delivery targets and alert rules from automation.targets.json.</li>
              <li>Ping each endpoint and measure latency plus status codes.</li>
              <li>Write public/runtime/health.json and public/runtime/history.json for the dashboard to consume.</li>
              <li>Commit the generated snapshots on the scheduled GitHub Action.</li>
            </ol>
          </article>

          <article className="panel alerts-panel">
            <span className="section-kicker">Alert rules</span>
            <h2>Live thresholds</h2>
            <div className="alert-list">
              {alerts.map((alert) => (
                <div className={`alert-row ${alert.triggered ? 'triggered' : 'ok'}`} key={alert.id}>
                  <div>
                    <strong>{alert.label}</strong>
                    <p>
                      {alert.scope === 'route' ? `${alert.route} · ` : ''}
                      {alert.metric} {alert.operator} {alert.threshold}
                    </p>
                  </div>
                  <span>{alert.triggered ? 'Triggered' : 'Healthy'}</span>
                </div>
              ))}
            </div>
            <p className="alert-footnote">
              {latestAlerts.length === 0
                ? 'No alerts are firing in the latest scheduled run.'
                : `${latestAlerts.length} alerts need attention.`}
            </p>
          </article>

          <article className="panel notes-panel">
            <span className="section-kicker">Operational notes</span>
            <h2>What this project is for</h2>
            <ul>
              {report.notes?.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        </aside>
      </section>

      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">History</span>
            <h2>Recent run performance</h2>
          </div>
          <span className="meta-chip subtle">{history.length} stored runs</span>
        </div>

        <div className="history-chart">
          <svg viewBox="0 0 1000 240" role="img" aria-label="Success rate history chart">
            <defs>
              <linearGradient id="history-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.42)" />
                <stop offset="100%" stopColor="rgba(56, 189, 248, 0.02)" />
              </linearGradient>
            </defs>
            <g className="chart-grid">
              {[0, 25, 50, 75, 100].map((tick) => (
                <g key={tick}>
                  <line x1="24" x2="976" y1={220 - (tick / 100) * 196} y2={220 - (tick / 100) * 196} />
                  <text x="0" y={224 - (tick / 100) * 196}>{tick}%</text>
                </g>
              ))}
            </g>
            {historyPath ? <path className="chart-area" d={`${historyPath} L 976 220 L 24 220 Z`} /> : null}
            {historyPath ? <path className="chart-line" d={historyPath} /> : null}
          </svg>
        </div>

        <div className="history-list">
          {history.slice(-7).map((entry) => (
            <div className="history-row" key={entry.generatedAt}>
              <strong>{formatDateTime(entry.generatedAt)}</strong>
              <span>{formatPercent(entry.successRate ?? 0)}</span>
              <small>
                {entry.healthy}/{entry.total} healthy · {entry.averageLatencyMs} ms avg ·{' '}
                {entry.alerts?.filter((alert) => alert.triggered).length || 0} alerts
              </small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
