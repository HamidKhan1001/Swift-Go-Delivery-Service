import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const rootDir = process.cwd();
const configPath = resolve(rootDir, 'automation.targets.json');
const outputPath = resolve(rootDir, 'public/runtime/health.json');
const historyPath = resolve(rootDir, 'public/runtime/history.json');
const dryRun = process.argv.includes('--dry-run');

function getNextRunAt(now) {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(2, 40, 0, 0);
  return next.toISOString();
}

async function checkTarget(target) {
  const startedAt = new Date();
  const started = performance.now();
  const controller = new AbortController();
  const timeoutMs = target.timeoutMs ?? 8000;
  const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const ok = response.status === target.expectedStatus;

    return {
      name: target.name,
      category: target.category,
      route: target.route || target.category?.toLowerCase() || 'general',
      url: target.url,
      expectedStatus: target.expectedStatus,
      status: response.status,
      ok,
      latencyMs,
      checkedAt: startedAt.toISOString(),
      note: ok
        ? 'Endpoint returned the expected response.'
        : `Expected ${target.expectedStatus} but received ${response.status}.`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);

    return {
      name: target.name,
      category: target.category,
      route: target.route || target.category?.toLowerCase() || 'general',
      url: target.url,
      expectedStatus: target.expectedStatus,
      status: 0,
      ok: false,
      latencyMs,
      checkedAt: startedAt.toISOString(),
      note: error?.name === 'AbortError' ? 'Request timed out.' : 'Fetch failed before receiving a response.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildRouteMetrics(targets, checks) {
  const grouped = new Map();

  for (const target of targets) {
    const route = target.route || target.category?.toLowerCase() || 'general';
    if (!grouped.has(route)) {
      grouped.set(route, {
        route,
        label: route.charAt(0).toUpperCase() + route.slice(1),
        total: 0,
        healthy: 0,
        degraded: 0,
        averageLatencyMs: 0,
        successRate: 0,
      });
    }
  }

  for (const check of checks) {
    const route = check.route || 'general';
    const bucket = grouped.get(route) || {
      route,
      label: route.charAt(0).toUpperCase() + route.slice(1),
      total: 0,
      healthy: 0,
      degraded: 0,
      averageLatencyMs: 0,
      successRate: 0,
    };

    bucket.total += 1;
    bucket.healthy += check.ok ? 1 : 0;
    bucket.degraded += check.ok ? 0 : 1;
    bucket.averageLatencyMs += Number(check.latencyMs || 0);
    grouped.set(route, bucket);
  }

  return Array.from(grouped.values()).map((bucket) => ({
    ...bucket,
    averageLatencyMs: bucket.total === 0 ? 0 : Math.round(bucket.averageLatencyMs / bucket.total),
    successRate: bucket.total === 0 ? 0 : Number(((bucket.healthy / bucket.total) * 100).toFixed(1)),
  }));
}

function evaluateAlerts(rules, summary, routeMetrics) {
  return rules.map((rule) => {
    const source = rule.scope === 'route'
      ? routeMetrics.find((entry) => entry.route === rule.route)
      : summary;
    const value = source?.[rule.metric];
    let triggered = false;

    if (typeof value === 'number') {
      if (rule.operator === 'lt') {
        triggered = value < rule.threshold;
      } else if (rule.operator === 'gt') {
        triggered = value > rule.threshold;
      }
    }

    return {
      id: rule.id,
      label: rule.label,
      scope: rule.scope,
      route: rule.route,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      value,
      triggered,
      status: triggered ? 'triggered' : 'ok',
    };
  });
}

async function readHistory(defaultEntry) {
  try {
    const parsed = JSON.parse(await readFile(historyPath, 'utf8'));
    if (Array.isArray(parsed.runs)) {
      return parsed.runs;
    }
  } catch {
    // Use the default entry when no history file exists yet.
  }

  return [defaultEntry];
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const targets = Array.isArray(config.targets) ? config.targets : [];
  const checks = await Promise.all(targets.map(checkTarget));
  const healthy = checks.filter((check) => check.ok).length;
  const total = checks.length;
  const averageLatencyMs =
    total === 0
      ? 0
      : Math.round(checks.reduce((sum, check) => sum + check.latencyMs, 0) / total);
  const successRate = total === 0 ? 0 : Number(((healthy / total) * 100).toFixed(1));
  const generatedAt = new Date().toISOString();
  const summary = {
    total,
    healthy,
    degraded: total - healthy,
    averageLatencyMs,
    successRate,
  };
  const routeMetrics = buildRouteMetrics(targets, checks);
  const alerts = evaluateAlerts(config.alertRules || [], summary, routeMetrics);
  const historyEntry = {
    generatedAt,
    healthy,
    total,
    degraded: total - healthy,
    averageLatencyMs,
    successRate,
    routeMetrics,
    alerts,
  };
  const history = [...(await readHistory(historyEntry)), historyEntry].slice(-14);
  const report = {
    generatedAt,
    nextRunAt: getNextRunAt(new Date(generatedAt)),
    project: config.project,
    summary,
    routeMetrics,
    alerts,
    history,
    checks,
    notes: [
      'The GitHub Actions cron job can run this same script on a schedule.',
      'Use npm run report locally to refresh the dashboard snapshot.',
    ],
  };

  if (!dryRun) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(historyPath, `${JSON.stringify({ runs: history }, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});