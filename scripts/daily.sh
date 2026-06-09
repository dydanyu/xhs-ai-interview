#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# 让 cron 的最小环境能找到 node/npm(nvm)与 cursor-agent
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.local/bin:$HOME/.cursor/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="data/daily.log"
mkdir -p data
echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily start =====" >> "$LOG"
npm run daily >> "$LOG" 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') daily done =====" >> "$LOG"
