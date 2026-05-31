import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || '';
const WORKSPACE_SLUG = __ENV.WORKSPACE_SLUG || '';
const TARGET_VUS = Number.parseInt(__ENV.TARGET_VUS || '1000', 10);

const errorRate = new Rate('project_hub_errors');
const apiDuration = new Trend('project_hub_api_duration');

export const options = {
  scenarios: {
    workspace_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: Math.floor(TARGET_VUS * 0.25) },
        { duration: '3m', target: Math.floor(TARGET_VUS * 0.5) },
        { duration: '5m', target: TARGET_VUS },
        { duration: '10m', target: TARGET_VUS },
        { duration: '3m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    project_hub_errors: ['rate<0.01'],
  },
};

function authHeaders() {
  return ACCESS_TOKEN
    ? { Authorization: `Bearer ${ACCESS_TOKEN}` }
    : {};
}

function get(path) {
  const response = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders(),
    tags: { endpoint: path.split('?')[0] },
  });

  apiDuration.add(response.timings.duration);
  errorRate.add(response.status >= 400);

  check(response, {
    'status < 400': (res) => res.status < 400,
    'body is not empty': (res) => !!res.body && res.body.length > 0,
  });

  return response;
}

export default function () {
  if (!ACCESS_TOKEN || !WORKSPACE_SLUG) {
    get('/api/workspaces');
    sleep(1);
    return;
  }

  get('/api/workspaces');
  get(`/api/workspaces/${WORKSPACE_SLUG}`);
  get(`/api/workspaces/${WORKSPACE_SLUG}/teams?limit=1`);
  get(`/api/workspaces/${WORKSPACE_SLUG}/members?limit=1`);
  get(`/api/workspaces/${WORKSPACE_SLUG}/projects?limit=6`);
  get(`/api/workspaces/${WORKSPACE_SLUG}/analytics`);

  sleep(Math.random() * 2 + 1);
}
