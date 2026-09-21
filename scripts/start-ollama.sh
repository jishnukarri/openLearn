#!/usr/bin/env bash
# Starts the local Ollama server if it isn't already running.
# Ollama was installed to ~/.local/ollama (no sudo available in this
# environment for the normal systemd-managed install), so it has to be
# started manually — this script is the "manually" part.
set -e

if curl -s -o /dev/null http://127.0.0.1:11434/api/version; then
  echo "Ollama already running."
  exit 0
fi

nohup ~/.local/ollama/bin/ollama serve > /tmp/ollama.log 2>&1 &
disown
echo "Started Ollama (logs: /tmp/ollama.log). Waiting for it to come up..."
until curl -s -o /dev/null http://127.0.0.1:11434/api/version; do sleep 0.5; done
echo "Ready."
