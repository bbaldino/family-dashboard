#!/usr/bin/env bash
# Capture paired scoreboard + summary snapshots for a live MLB game.
#
# Usage:
#   scripts/capture-live-mlb-game.sh [options] [GAME_ID]
#
# Options:
#   -i, --interval N    Poll interval in seconds (default: 60)
#   -l, --list          List currently in-progress MLB games and exit
#   -h, --help          Show this help
#
# GAME_ID is optional. If omitted, the first in-progress game on today's
# scoreboard is used.
#
# Output: backend/tests/fixtures/live-snapshots/<GAME_ID>/
#   <ISO8601>-scoreboard.json   (full scoreboard response at that moment)
#   <ISO8601>-summary.json      (full /summary response for the game)
#
# Stops on Ctrl+C, or automatically when the game enters state "post" (final).

set -euo pipefail

SCOREBOARD_URL='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'
SUMMARY_URL_BASE='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event='

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_BASE="$REPO_ROOT/backend/tests/fixtures/live-snapshots"

GAME_ID=""
INTERVAL=60
MODE="capture"

usage() {
  sed -n '2,18p' "${BASH_SOURCE[0]}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--interval)
      INTERVAL="$2"; shift 2 ;;
    --interval=*)
      INTERVAL="${1#*=}"; shift ;;
    -l|--list)
      MODE="list"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    -*)
      echo "unknown option: $1" >&2; usage; exit 2 ;;
    *)
      if [[ -n "$GAME_ID" ]]; then
        echo "unexpected extra argument: $1" >&2; usage; exit 2
      fi
      GAME_ID="$1"; shift ;;
  esac
done

log() { echo "[capture] $*" >&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || { log "missing required command: $1"; exit 1; }
}
require curl
require jq

list_live_games() {
  curl -fsS "$SCOREBOARD_URL" | jq -r '
    .events
    | map(select(.status.type.state == "in"))
    | .[]
    | "\(.id)\t\(.status.type.detail)\t\(.name)"
  '
}

find_live_game_id() {
  list_live_games | head -1 | cut -f1
}

if [[ "$MODE" == "list" ]]; then
  out=$(list_live_games || true)
  if [[ -z "$out" ]]; then
    log "no live MLB games right now"
    exit 1
  fi
  printf "%s\n" "$out"
  exit 0
fi

if [[ -z "$GAME_ID" ]]; then
  log "no GAME_ID given; looking for any in-progress MLB game..."
  GAME_ID=$(find_live_game_id || true)
  if [[ -z "$GAME_ID" ]]; then
    log "no live MLB games right now. Pass a GAME_ID explicitly, or use --list."
    log "  upcoming today:"
    curl -fsS "$SCOREBOARD_URL" | jq -r '.events[] | "    \(.id)  \(.status.type.detail)  \(.name)"' | head -5 >&2
    exit 1
  fi
  log "found live game: $GAME_ID"
fi

# Confirm the game ID is real and grab a name for nicer logging
GAME_LABEL=$(curl -fsS "${SUMMARY_URL_BASE}${GAME_ID}" \
  | jq -r '.header.competitions[0].competitors | map(.team.abbreviation) | join(" @ ")' \
  || echo "")
if [[ -z "$GAME_LABEL" ]]; then
  log "game $GAME_ID didn't return a valid summary; aborting"
  exit 1
fi

OUT_DIR="$OUT_BASE/$GAME_ID"
mkdir -p "$OUT_DIR"
log "capturing $GAME_LABEL (id=$GAME_ID) every ${INTERVAL}s into $OUT_DIR"
log "press Ctrl+C to stop; will also stop automatically when the game ends"

snapshot_count=0
while true; do
  ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)

  scoreboard_path="$OUT_DIR/${ts}-scoreboard.json"
  summary_path="$OUT_DIR/${ts}-summary.json"

  if ! curl -fsS "$SCOREBOARD_URL" > "$scoreboard_path.tmp"; then
    log "[$ts] scoreboard fetch failed; skipping snapshot"
    rm -f "$scoreboard_path.tmp"
    sleep "$INTERVAL"
    continue
  fi
  mv "$scoreboard_path.tmp" "$scoreboard_path"

  if ! curl -fsS "${SUMMARY_URL_BASE}${GAME_ID}" > "$summary_path.tmp"; then
    log "[$ts] summary fetch failed; keeping scoreboard, dropping summary"
    rm -f "$summary_path.tmp"
  else
    mv "$summary_path.tmp" "$summary_path"
  fi

  snapshot_count=$((snapshot_count + 1))

  # Pull a brief status from the summary we just saved
  state=$(jq -r '.header.competitions[0].status.type.state // "unknown"' "$summary_path" 2>/dev/null || echo "unknown")
  detail=$(jq -r '.header.competitions[0].status.type.detail // ""' "$summary_path" 2>/dev/null || echo "")
  away_score=$(jq -r '.header.competitions[0].competitors[] | select(.homeAway=="away") | .score // "?"' "$summary_path" 2>/dev/null || echo "?")
  home_score=$(jq -r '.header.competitions[0].competitors[] | select(.homeAway=="home") | .score // "?"' "$summary_path" 2>/dev/null || echo "?")

  log "[$ts] snapshot #$snapshot_count — state=$state ${away_score}-${home_score} $detail"

  if [[ "$state" == "post" ]]; then
    log "game is final; stopping after $snapshot_count snapshot(s)"
    exit 0
  fi

  sleep "$INTERVAL"
done
