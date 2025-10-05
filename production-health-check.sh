#!/bin/bash
# Production Health Check Script
# Tests all critical services for WebQx EMR

set -e

PRODUCTION_URL="${1:-https://webqx-production.up.railway.app}"
COLORS=true

# Colors
if [ "$COLORS" = "true" ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         WebQx EMR Production Health Check                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Target:${NC} $PRODUCTION_URL"
echo -e "${BLUE}Time:${NC} $(date)"
echo ""

# Test 1: Unified Server Health
echo -e "${YELLOW}[1/7]${NC} Testing Unified Server..."
if curl -sf "$PRODUCTION_URL/health" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Unified server is online"
else
  echo -e "  ${RED}✗${NC} Unified server is offline or unreachable"
  exit 1
fi

# Test 2: WebQx EMR Service
echo -e "${YELLOW}[2/7]${NC} Testing WebQx EMR Service..."
WEBQX_HEALTH=$(curl -sf "$PRODUCTION_URL:3100/health" 2>&1)
if [ $? -eq 0 ]; then
  UPTIME=$(echo "$WEBQX_HEALTH" | grep -oP '"uptime_s":"[^"]*"' | cut -d'"' -f4)
  echo -e "  ${GREEN}✓${NC} WebQx EMR is online (uptime: ${UPTIME}s)"
else
  echo -e "  ${RED}✗${NC} WebQx EMR service is offline"
  echo -e "  ${YELLOW}Note:${NC} Port 3100 may not be exposed externally"
fi

# Test 3: Comprehensive Health Check
echo -e "${YELLOW}[3/7]${NC} Testing Backend Services (Medplum, Nextcloud, OpenAI)..."
FULL_HEALTH=$(curl -sf "$PRODUCTION_URL:3100/emr/health/full" 2>&1)
if [ $? -eq 0 ]; then
  STATUS=$(echo "$FULL_HEALTH" | grep -oP '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ "$STATUS" = "healthy" ]; then
    echo -e "  ${GREEN}✓${NC} All backend services are healthy"
    
    # Parse individual services
    MEDPLUM_STATUS=$(echo "$FULL_HEALTH" | grep -oP '"medplum":.*?"status":"[^"]*"' | grep -oP 'status":"[^"]*"' | cut -d'"' -f3)
    NEXTCLOUD_STATUS=$(echo "$FULL_HEALTH" | grep -oP '"nextcloud":.*?"status":"[^"]*"' | grep -oP 'status":"[^"]*"' | cut -d'"' -f3)
    
    echo -e "    ${GREEN}→${NC} Medplum: $MEDPLUM_STATUS"
    echo -e "    ${GREEN}→${NC} Nextcloud: $NEXTCLOUD_STATUS"
    
  elif [ "$STATUS" = "degraded" ]; then
    echo -e "  ${YELLOW}⚠${NC} Backend services are degraded"
    echo "$FULL_HEALTH" | grep -oP '"warnings":\[[^\]]*\]' || true
  else
    echo -e "  ${RED}✗${NC} Backend configuration incomplete"
    echo -e "  ${YELLOW}Response:${NC}"
    echo "$FULL_HEALTH" | jq '.' 2>/dev/null || echo "$FULL_HEALTH"
  fi
else
  echo -e "  ${RED}✗${NC} Cannot reach health check endpoint"
fi

# Test 4: Readiness Probe
echo -e "${YELLOW}[4/7]${NC} Testing Kubernetes Readiness..."
READY=$(curl -sf "$PRODUCTION_URL:3100/emr/health/ready" 2>&1)
if [ $? -eq 0 ]; then
  IS_READY=$(echo "$READY" | grep -oP '"ready":(true|false)' | cut -d':' -f2)
  if [ "$IS_READY" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} Service is ready to accept traffic"
  else
    echo -e "  ${YELLOW}⚠${NC} Service is not ready"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Readiness probe not accessible"
fi

# Test 5: Liveness Probe
echo -e "${YELLOW}[5/7]${NC} Testing Kubernetes Liveness..."
ALIVE=$(curl -sf "$PRODUCTION_URL:3100/emr/health/live" 2>&1)
if [ $? -eq 0 ]; then
  UPTIME=$(echo "$ALIVE" | grep -oP '"uptime_seconds":[0-9]+' | cut -d':' -f2)
  echo -e "  ${GREEN}✓${NC} Service is alive (uptime: ${UPTIME}s)"
else
  echo -e "  ${RED}✗${NC} Liveness probe failed"
fi

# Test 6: Telehealth Server
echo -e "${YELLOW}[6/7]${NC} Testing Telehealth Server (Jitsi Meet)..."
TELEHEALTH_HEALTH=$(curl -sf "$PRODUCTION_URL:3003/health" 2>&1)
if [ $? -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} Telehealth server is online"
else
  echo -e "  ${YELLOW}⚠${NC} Telehealth server not accessible externally"
  echo -e "  ${YELLOW}Note:${NC} Port 3003 may not be exposed"
fi

# Test 7: CORS Configuration
echo -e "${YELLOW}[7/7]${NC} Testing CORS Configuration..."
CORS_TEST=$(curl -sf -H "Origin: https://webqx.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS "$PRODUCTION_URL:3100/emr/status" -I 2>&1)

if echo "$CORS_TEST" | grep -q "access-control-allow-origin"; then
  ALLOWED_ORIGIN=$(echo "$CORS_TEST" | grep -i "access-control-allow-origin" | cut -d' ' -f2 | tr -d '\r')
  echo -e "  ${GREEN}✓${NC} CORS is configured (allows: $ALLOWED_ORIGIN)"
else
  echo -e "  ${YELLOW}⚠${NC} CORS headers not found or restrictive"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Health check complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check warnings above (if any)"
echo "  2. Verify Railway environment variables are set"
echo "  3. Test from frontend: https://webqx.github.io"
echo "  4. Check logs: railway logs --tail 100"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  - Deployment: ./DEPLOYMENT_COMPLETE_READY.md"
echo "  - Nextcloud Setup: ./NEXTCLOUD_QUICK_START.md"
echo "  - Critical Config: ./CRITICAL_CONFIGURATION_REQUIRED.md"
echo ""
