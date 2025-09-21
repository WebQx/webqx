#!/usr/bin/env bash
set -euo pipefail

# Configure Apache to use provided PORT (Railway) or default 8080
PORT="${PORT:-8080}"
if [ "$PORT" != "80" ]; then
  sed -ri "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf || true
  sed -ri "s/:80>/:${PORT}>/g" /etc/apache2/sites-available/000-default.conf || true
fi

# Optional DB configuration via env vars
DB_HOST="${WEBQX_DB_HOST:-${MYSQL_HOST:-localhost}}"
DB_PORT="${WEBQX_DB_PORT:-${MYSQL_PORT:-3306}}"
DB_NAME="${WEBQX_DB_NAME:-webqx_emr}"
DB_USER="${WEBQX_DB_USER:-webqx_user}"
DB_PASS="${WEBQX_DB_PASS:-webqx_pass_2024!}"

SQLCONF="/var/www/html/sites/default/sqlconf.php"
if [ -n "${WEBQX_DB_HOST:-}" ] || [ -n "${MYSQL_HOST:-}" ]; then
  echo "[entrypoint] Writing sqlconf.php from environment"
  cat > "$SQLCONF" <<PHP
<?php
global $disable_utf8_flag; $disable_utf8_flag = false;
$host = '${DB_HOST}'; $port='${DB_PORT}'; $login='${DB_USER}'; $pass='${DB_PASS}'; $dbase='${DB_NAME}'; $db_encoding='utf8mb4';
$sqlconf = array(); global $sqlconf; $sqlconf["host"]=$host; $sqlconf["port"]=$port; $sqlconf["login"]=$login; $sqlconf["pass"]=$pass; $sqlconf["dbase"]=$dbase; $sqlconf["db_encoding"]=$db_encoding;
$config = 0;
PHP
  chown www-data:www-data "$SQLCONF" || true
fi

echo "Starting WebQX OpenEMR (Apache) on port ${PORT}"
exec "$@"
