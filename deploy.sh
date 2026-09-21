#!/usr/bin/env bash
# Deploys this project to a remote server over SSH: syncs the source (via
# tar, no rsync dependency required on either end), then runs
# scripts/deploy-remote.sh there to build it and serve it through Caddy
# (auto-HTTPS reverse proxy) under pm2 (auto-restarting process manager).
set -euo pipefail

# =========================== CONFIGURATION ============================
REMOTE_HOST="193.123.180.181"
REMOTE_USER="ubuntu"
SSH_KEY="/home/phantom/.ssh/id_ed25519"
DOMAIN="prod.openlearn.services.jishnu.tech"
REMOTE_APP_DIR="/home/ubuntu/open_learn"
APP_PORT="3000"
# ========================================================================

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"

if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH_KEY not found at $SSH_KEY" >&2
  exit 1
fi

echo "==> Step 1/2: syncing project files to $REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR"
$SSH "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_APP_DIR'"
tar czf - \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude=".git" \
  --exclude=".env.local" \
  -C "$LOCAL_DIR" . \
  | $SSH "$REMOTE_USER@$REMOTE_HOST" "tar xzf - -C '$REMOTE_APP_DIR'"

echo "==> Step 2/2: building and deploying on the server"
chmod +x "$LOCAL_DIR/scripts/deploy-remote.sh" 2>/dev/null || true
$SSH "$REMOTE_USER@$REMOTE_HOST" "bash '$REMOTE_APP_DIR/scripts/deploy-remote.sh' '$DOMAIN' '$APP_PORT' '$REMOTE_APP_DIR'"

echo
echo "Done. https://$DOMAIN should be live within a minute or two."
