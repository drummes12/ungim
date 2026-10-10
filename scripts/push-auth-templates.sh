#!/usr/bin/env bash
# Pushes supabase/email-templates/*.html to the hosted project's auth config
# via the Management API (PATCH /v1/projects/{ref}/config/auth).
# Requires: SUPABASE_ACCESS_TOKEN (PAT) and SUPABASE_PROJECT_ID.
set -euo pipefail

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth"
AUTH="Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"

declare -A MAP=(
  [invite]='mailer_templates_invite_content'
  [confirm-signup]='mailer_templates_confirmation_content'
  [recovery]='mailer_templates_recovery_content'
  [magic-link]='mailer_templates_magic_link_content'
  [email-change]='mailer_templates_email_change_content'
  [reauthentication]='mailer_templates_reauthentication_content'
  [password-changed]='mailer_templates_password_changed_notification_content'
)

current=$(curl -sf "$API" -H "$AUTH")

payload='{}'
for name in "${!MAP[@]}"; do
  key="${MAP[$name]}"
  file="supabase/email-templates/${name}.html"
  [ -f "$file" ] || continue
  if ! jq -e --arg k "$key" 'has($k)' <<<"$current" >/dev/null; then
    echo "::warning::Auth config has no $key — skipping ${name}.html"
    continue
  fi
  payload=$(jq --arg k "$key" --rawfile v "$file" '. + {($k): $v}' <<<"$payload")
done

if [ "$payload" = '{}' ]; then
  echo 'No template fields to update.'
  exit 0
fi

curl -sf -X PATCH "$API" -H "$AUTH" -H 'Content-Type: application/json' -d "$payload" -o /dev/null
echo "Auth email templates updated on ${SUPABASE_PROJECT_ID}."
