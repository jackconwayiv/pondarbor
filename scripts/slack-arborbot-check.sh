#!/usr/bin/env bash
# Verify ArborBot env and print Slack webhook URLs. Run on Appliku (Run Command) or locally with .env loaded.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

missing=0
need_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "MISSING: $name"
    missing=1
  else
    echo "OK: $name is set"
  fi
}

echo "=== ArborBot environment ==="
need_var SLACK_SIGNING_SECRET
need_var SLACK_BOT_TOKEN
need_var SLACK_PROMPTS_CHANNEL_ID

if [[ -n "${SLACK_SONGADAY_CHANNEL_ID:-}" ]]; then
  echo "OK: SLACK_SONGADAY_CHANNEL_ID is set (events listen channel)"
elif [[ -n "${SLACK_PROMPTS_CHANNEL_ID:-}" ]]; then
  echo "OK: SLACK_SONGADAY_CHANNEL_ID unset — events will use SLACK_PROMPTS_CHANNEL_ID"
else
  echo "MISSING: SLACK_PROMPTS_CHANNEL_ID (required; also used for events when SLACK_SONGADAY_CHANNEL_ID unset)"
  missing=1
fi

if [[ -n "${SLACK_BOT_TOKEN:-}" ]]; then
  if [[ "${SLACK_BOT_TOKEN}" == xoxb-* ]]; then
    echo "OK: SLACK_BOT_TOKEN looks like a bot token (xoxb-…)"
  else
    echo "WARN: SLACK_BOT_TOKEN should start with xoxb- (bot token, not user OAuth)"
  fi
fi

if [[ -n "${SONGADAY_SLACK_PROMPT_TIMEZONE:-}" ]]; then
  echo "OK: SONGADAY_SLACK_PROMPT_TIMEZONE=${SONGADAY_SLACK_PROMPT_TIMEZONE}"
else
  echo "INFO: SONGADAY_SLACK_PROMPT_TIMEZONE unset (defaults to UTC on server)"
fi

if [[ -n "${SLACK_CREATE_ACCOUNT_URL:-}" ]]; then
  echo "OK: SLACK_CREATE_ACCOUNT_URL=${SLACK_CREATE_ACCOUNT_URL}"
else
  echo "INFO: SLACK_CREATE_ACCOUNT_URL unset (defaults to https://www.pondarbor.com/)"
fi

if [[ -n "${VITE_AUTH0_SLACK_CONNECTION:-}" ]]; then
  echo "WARN: VITE_AUTH0_SLACK_CONNECTION is set — Slack OAuth login UI may appear (not required for ArborBot)"
else
  echo "OK: VITE_AUTH0_SLACK_CONNECTION unset (no Slack OAuth login)"
fi

echo ""
echo "=== Webhook URLs (configure in Slack app if not using manifest) ==="
ORIGIN="${SLACK_CREATE_ACCOUNT_URL:-https://www.pondarbor.com/}"
ORIGIN="${ORIGIN%/}"
echo "Events API:  ${ORIGIN}/api/v1/slack/events/"
echo "Slash /song: ${ORIGIN}/api/v1/slack/commands/"
echo "Slash /prompt: ${ORIGIN}/api/v1/slack/commands/"
echo "Slash /quote: ${ORIGIN}/api/v1/slack/commands/"
echo "Slash /randomquote: ${ORIGIN}/api/v1/slack/commands/"

echo ""
echo "=== Django admin: link Slack users ==="
echo "Admin → Slack identities → Add row:"
echo "  team_id:       workspace ID (T… from Slack app install / event payload)"
echo "  slack_user_id: member ID (U… from Slack profile → Copy member ID)"
echo "  user:          PondArbor account"
echo ""
echo "Email auto-match: if admin row missing, first channel post may auto-link when Slack email matches PondArbor email."

if [[ "$missing" -ne 0 ]]; then
  echo ""
  echo "Fix missing variables in Appliku → Environment Variables, then redeploy."
  exit 1
fi

echo ""
echo "All required SLACK_* variables are set."
