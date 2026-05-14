#!/usr/bin/env bash
# Curl-based API tests for the deepenc-harness dashboard
# Usage: bash dashboard/test-api.sh [port]
set -euo pipefail

PORT="${1:-3098}"
BASE="http://127.0.0.1:$PORT"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

check_json() {
  local desc="$1" url="$2" expected="$3"
  local body
  body=$(curl -sf "$url" 2>/dev/null) || { fail "$desc (curl failed)"; return; }
  if echo "$body" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    exec('''
$expected
''')
    sys.exit(0)
except Exception as e:
    print('  expected:', e)
    sys.exit(1)
" 2>/dev/null; then
    ok "$desc"
  else
    fail "$desc"
  fi
}

check_status() {
  local desc="$1" url="$2" expected_status="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || { fail "$desc (curl failed)"; return; }
  if [ "$status" = "$expected_status" ]; then
    ok "$desc"
  else
    fail "$desc (expected $expected_status, got $status)"
  fi
}

echo "Starting dashboard server on port $PORT..."
node lib/index.js dashboard --port "$PORT" > /tmp/dash-test.log 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null; exit 1" INT TERM

sleep 2

echo ""
echo "=== API Tests ==="
echo ""

check_json "Health endpoint returns ok" \
  "$BASE/api/health" \
  "assert d['status'] == 'ok'"

check_json "Days endpoint lists days" \
  "$BASE/api/days" \
  "assert len(d['days']) >= 2; assert '2026-05-11' in d['days']"

check_json "Latest day returns correct date" \
  "$BASE/api/days/latest" \
  "assert d['date'] == '2026-05-12'"

check_json "Specific day returns correct data" \
  "$BASE/api/days/2026-05-11" \
  "assert d['total_sessions'] == 10; assert d['total_prompter_time_hours'] == 18.8"

check_status "Missing day returns 404" \
  "$BASE/api/days/2099-01-01" 404

check_json "Sessions endpoint returns list" \
  "$BASE/api/sessions" \
  "assert d['total'] >= 18; assert len(d['sessions']) > 0"

check_json "Session detail returns summary + detail" \
  "$BASE/api/sessions/2026-05-12-asm-optimizer-dq-implementation" \
  "assert d['summary'] is not None; assert d['detail'] is not None"

check_status "Missing session returns 404" \
  "$BASE/api/sessions/nonexistent-session" 404

check_json "Stats returns cross-day aggregates" \
  "$BASE/api/stats" \
  "assert d['total_days'] == 2; assert d['total_sessions'] == 18"

check_json "Search by summary returns results" \
  "$BASE/api/search?q=SIMD" \
  "assert len(d['results']) > 0"

check_json "Search with no match returns empty" \
  "$BASE/api/search?q=zzz_nonexistent_zzz" \
  "assert len(d['results']) == 0"

check_json "Search by transcript content returns results" \
  "$BASE/api/search?q=AVX2" \
  "assert len(d['results']) > 0"

check_json "Git log returns commits" \
  "$BASE/api/git/log" \
  "assert len(d['commits']) > 0"

check_json "Git stats returns per_date" \
  "$BASE/api/git/stats" \
  "assert d['total_commits'] > 0; assert 'per_date' in d"

check_json "Git commit diff returns content" \
  "$BASE/api/git/commit/HEAD" \
  "assert len(d['diff']) > 100"

check_status "Missing commit returns 404" \
  "$BASE/api/git/commit/0000000000000000000000000000000000000000" 404

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null || true

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
