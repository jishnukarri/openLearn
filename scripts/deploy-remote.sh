#!/usr/bin/env bash
# Runs ON THE SERVER (invoked over SSH by deploy.bat, after the project has
# already been rsynced there). Builds the app, keeps it running under pm2,
# and reverse-proxies a domain to it through Caddy (which auto-provisions
# HTTPS via Let's Encrypt — the domain's DNS A record must already point at
# this server before this script runs, or cert issuance will fail).
set -euo pipefail

DOMAIN="${1:?Usage: deploy-remote.sh <domain> <port> <app_dir>}"
PORT="${2:?Usage: deploy-remote.sh <domain> <port> <app_dir>}"
APP_DIR="${3:?Usage: deploy-remote.sh <domain> <port> <app_dir>}"
APP_NAME="open_learn"

cd "$APP_DIR"

echo "==> Checking for .env.local"
if [ ! -f .env.local ]; then
  echo "WARNING: $APP_DIR/.env.local is missing."
  echo "It is deliberately NOT synced from your machine (it holds live"
  echo "secrets), so create it on the server by hand before the app can"
  echo "actually work. Continuing anyway so you can see the rest run."
fi

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Building"
npm run build

echo "==> Ensuring pm2 is installed"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Starting/reloading under pm2 on port $PORT"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT="$PORT" pm2 reload "$APP_NAME" --update-env
else
  PORT="$PORT" pm2 start npm --name "$APP_NAME" -- run start -- -p "$PORT"
fi
pm2 save

echo "==> Making pm2 survive a server reboot"
STARTUP_CMD="$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tail -n1)"
if [[ "$STARTUP_CMD" == sudo* ]]; then
  eval "$STARTUP_CMD"
fi

echo "==> Ensuring Caddy is installed"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
fi

echo "==> Writing /etc/caddy/Caddyfile for $DOMAIN -> localhost:$PORT"
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
$DOMAIN {
    reverse_proxy localhost:$PORT
}
EOF

echo "==> Reloading Caddy"
sudo systemctl enable caddy
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy

echo "==> Done. https://$DOMAIN should be live within a minute or two"
echo "    (Caddy needs a moment to fetch the TLS certificate on first run)."
