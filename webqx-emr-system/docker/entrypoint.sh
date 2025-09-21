#!/usr/bin/env bash
set -euo pipefail

# Configure Apache to use provided PORT (Railway) or default 8080
PORT="${PORT:-8080}"
if [ "$PORT" != "80" ]; then
  sed -ri "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf || true
  sed -ri "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf || true
fi

# Map env vars expected by OpenEMR (if present)
# These can be used by setup or config scripts; we don't hardwrite sqlconf.php here
export WEBQX_DB_HOST="${WEBQX_DB_HOST:-$MYSQL_HOST:-}" || true
export WEBQX_DB_NAME="${WEBQX_DB_NAME:-openemr}"
export WEBQX_DB_USER="${WEBQX_DB_USER:-openemr}"
export WEBQX_DB_PASS="${WEBQX_DB_PASS:-openemr}"

# Log where we are starting from
echo "Starting WebQX OpenEMR (Apache) on port ${PORT}"

exec "$@"
