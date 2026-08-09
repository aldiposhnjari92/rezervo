#!/usr/bin/env bash
#
# Testet end-to-end: ndërton, nxjerr ID-të e veprimeve, nis serverin dhe i
# drejton të katër suitat.
#
#   ./tests/run-e2e.sh
#
# Ndërtimi shkon te .next-test, JO te .next — kështu `npm run dev` mund të vazhdojë
# të punojë paralelisht pa ia prishur njëri-tjetrit output-in.
#
# KUJDES: testet krijojnë llogari të vërteta te projekti Supabase i .env.local
# dhe i fshijnë vetë në fund. Mos e drejto kundër një baze prodhimi me klientë realë.
set -euo pipefail

cd "$(dirname "$0")/.."

DIST=".next-test"
PORT="${PORT:-3100}"
BASE="http://localhost:${PORT}"

if [ ! -f .env.local ]; then
  echo "Mungon .env.local — testet kanë nevojë për një projekt Supabase."
  exit 1
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Ndërtimi ($DIST)"
NEXT_DIST_DIR="$DIST" npx next build > /tmp/rezervo-e2e-build.log 2>&1 \
  || { tail -30 /tmp/rezervo-e2e-build.log; exit 1; }

echo "==> ID-të e veprimeve"
node tests/e2e/extract-actions.js "$DIST"

echo "==> Serveri në :$PORT"
NEXT_DIST_DIR="$DIST" npx next start -p "$PORT" > /tmp/rezervo-e2e-server.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  curl -sf -o /dev/null --max-time 2 "$BASE/" && break
  sleep 1
done

FAILED=0
for suite in main features admin shell realtime security; do
  echo ""
  echo "==================== $suite ===================="
  BASE="$BASE" node "tests/e2e/${suite}.js" || FAILED=1
done

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "Të gjitha suitat kaluan."
  echo "SHËNIM: 'admin' dhe 'shell' kanë edhe një fazë të dytë që kërkon një"
  echo "përdorues admin — shih tests/README.md."
else
  echo "Dështoi të paktën një suitë."
fi
exit "$FAILED"
