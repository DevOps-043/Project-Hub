# QA Performance Plan: 1000 Concurrent Users

## Objective

Validate that Project Hub supports 1000 concurrent authenticated users without request collapse, excessive latency, or database write amplification on hot read paths.

## Preconditions

- Apply migration `apps/database/migrations/019_performance_hardening_1000_users.sql` in QA.
- Run production build settings, not `next dev`.
- Configure realistic Supabase pool limits for the QA environment.
- Use representative data: at least 1 workspace, 20 teams, 200 projects, 5000 tasks, and 1000 workspace members.
- Disable verbose auth logs unless debugging: `AUTH_DEBUG=false`, `SOFIA_AUTH_DEBUG=false`, `DEBUG_WORKSPACE_SYNC=false`.

## Load Test

Install k6 and run:

```bash
k6 run scripts/load/project-hub-1000-users.k6.js \
  -e BASE_URL=https://qa.project-hub.example.com \
  -e ACCESS_TOKEN=<qa-access-token> \
  -e WORKSPACE_SLUG=<workspace-slug> \
  -e TARGET_VUS=1000
```

## Acceptance Targets

- Error rate below 1%.
- p95 API latency below 800 ms.
- p99 API latency below 1500 ms.
- No sustained 5xx bursts during ramp-up.
- Supabase CPU, active connections, and slow queries remain stable.

## What To Watch

- `/api/workspaces/:slug/analytics`: verify cache hit ratio and query duration.
- `/api/auth/me`: confirm `last_activity_at` writes are throttled.
- `/api/workspaces/:slug/members`: confirm dashboards call it with `limit=1` for counts.
- Bridge API key usage: confirm `increment_mcp_api_key_usage` is present.
- Task creation bursts: confirm no duplicate `(team_id, issue_number)` conflicts.

## Risk Notes

- The current analytics route still calculates some aggregates in application memory. For datasets much larger than QA, move analytics to SQL/RPC aggregate functions or materialized views.
- If QA generates traffic from very few IPs, align API gateway and Express `RATE_LIMIT_MAX` with the test profile.
- Supabase connection limits remain the main external bottleneck; add pooling or PgBouncer sizing before raising target concurrency further.
