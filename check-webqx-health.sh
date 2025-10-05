#!/bin/bash

# WebQx EMR - Daily Health Check Script
# Run this every morning to verify all systems are operational

echo "🏥 WebQx EMR Health Check"
echo "========================="
echo "Date: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (update these)
BACKEND_URL="https://webqx-production.up.railway.app"
NEXTCLOUD_URL="https://nextcloud.yourdomain.com"
MEDPLUM_URL="https://api.medplum.com"

# 1. Check Backend API
echo -n "Backend API ($BACKEND_URL): "
if response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health"); then
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ UP${NC} (HTTP $response)"
  else
    echo -e "${YELLOW}⚠️  Warning${NC} (HTTP $response)"
  fi
else
  echo -e "${RED}❌ DOWN${NC}"
fi

# 2. Check EMR Status Endpoint
echo -n "EMR Status Endpoint: "
if response=$(curl -s "$BACKEND_URL/emr/status"); then
  medplum_status=$(echo "$response" | jq -r '.services.medplum.status' 2>/dev/null)
  nextcloud_status=$(echo "$response" | jq -r '.services.nextcloud.status' 2>/dev/null)
  
  if [ "$medplum_status" = "available" ] && [ "$nextcloud_status" = "available" ]; then
    echo -e "${GREEN}✅ All Services Available${NC}"
    
    # Show latencies:
    medplum_latency=$(echo "$response" | jq -r '.services.medplum.latency_ms' 2>/dev/null)
    nextcloud_latency=$(echo "$response" | jq -r '.services.nextcloud.latency_ms' 2>/dev/null)
    echo "   - Medplum latency: ${medplum_latency}ms"
    echo "   - Nextcloud latency: ${nextcloud_latency}ms"
  else
    echo -e "${RED}❌ Service Unavailable${NC}"
    echo "   - Medplum: $medplum_status"
    echo "   - Nextcloud: $nextcloud_status"
  fi
else
  echo -e "${RED}❌ Cannot reach status endpoint${NC}"
fi

# 3. Check Nextcloud
echo -n "Nextcloud ($NEXTCLOUD_URL): "
if response=$(curl -s -o /dev/null -w "%{http_code}" "$NEXTCLOUD_URL"); then
  if [ "$response" = "200" ] || [ "$response" = "302" ]; then
    echo -e "${GREEN}✅ UP${NC} (HTTP $response)"
  else
    echo -e "${YELLOW}⚠️  Warning${NC} (HTTP $response)"
  fi
else
  echo -e "${RED}❌ DOWN${NC}"
fi

# 4. Check Medplum
echo -n "Medplum ($MEDPLUM_URL): "
if response=$(curl -s "$MEDPLUM_URL/healthcheck"); then
  if echo "$response" | grep -q "ok"; then
    echo -e "${GREEN}✅ UP${NC}"
  else
    echo -e "${RED}❌ DOWN${NC}"
  fi
else
  echo -e "${RED}❌ Cannot reach Medplum${NC}"
fi

# 5. Check Transcription Endpoint
echo -n "Transcription Endpoint: "
if response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/emr/transcribe" -X OPTIONS); then
  if [ "$response" = "200" ] || [ "$response" = "204" ]; then
    echo -e "${GREEN}✅ Available${NC}"
  else
    echo -e "${YELLOW}⚠️  May not be working${NC} (HTTP $response)"
  fi
else
  echo -e "${RED}❌ Cannot reach endpoint${NC}"
fi

echo ""
echo "========================="

# Summary
all_up=true
if ! curl -s "$BACKEND_URL/health" | grep -q "ok"; then all_up=false; fi
if ! curl -s "$NEXTCLOUD_URL" > /dev/null 2>&1; then all_up=false; fi
if ! curl -s "$MEDPLUM_URL/healthcheck" | grep -q "ok"; then all_up=false; fi

if [ "$all_up" = true ]; then
  echo -e "${GREEN}✅ All systems operational!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some systems are down. Check logs.${NC}"
  exit 1
fi
