#!/usr/bin/env bash
set -Eeuo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repository"
: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Set DEPLOY_KNOWN_HOSTS}"
: "${BACKEND_BASEURL:?Set BACKEND_BASEURL}"
source_root=${DEPLOY_BACKEND_ROOT:-/srv/ycoj-v3}
process_name=${DEPLOY_BACKEND_PM2_NAME:-ycoj}
deploy_port=${DEPLOY_PORT:-22}
health_url=${DEPLOY_BACKEND_HEALTH_URL:-${BACKEND_BASEURL%/}/branding?origin=http%3A%2F%2Flocalhost}
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$deploy_port" =~ ^[0-9]+$ && "$deploy_port" -ge 1 && "$deploy_port" -le 65535 ]]
[[ "$source_root" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]]
[[ "$process_name" =~ ^[a-zA-Z][a-zA-Z0-9_-]*$ && "$process_name" != all ]]
[[ "$health_url" = http://* || "$health_url" = https://* ]]

head=$(git rev-parse HEAD)
remote_head=$(git ls-remote --exit-code origin refs/heads/master)
if [[ "${remote_head%%[[:space:]]*}" != "$head" ]]; then
  echo 'Skipping backend deployment: master has advanced.'
  exit 0
fi

credentials=$(mktemp -d)
trap 'rm -rf -- "$credentials"' EXIT
chmod 700 "$credentials"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$credentials/id"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$credentials/known_hosts"
chmod 600 "$credentials/id" "$credentials/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
options=(-i "$credentials/id" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$credentials/known_hosts"
  -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
printf -v command 'bash -s -- %q %q %q %q' "$source_root" "$head" "$process_name" "$health_url"
printf -v login_command 'bash -lc %q' "$command"
ssh "${options[@]}" -p "$deploy_port" "$DEPLOY_USER@$DEPLOY_HOST" "$login_command" \
  < .cnb/update-backend.sh
