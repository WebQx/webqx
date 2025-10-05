#!/bin/bash
# Quick status check for WebQx EMR Production

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         WebQx EMR Production Status Check                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PROD_URL="https://webqx-production.up.railway.app"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔍 Checking services..."
echo ""

# Test 1: Transcription Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  OpenAI Whisper Transcription"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TRANSCRIBE_STATUS=$(curl -s "${PROD_URL}/emr/transcribe/status")
if echo "$TRANSCRIBE_STATUS" | grep -q '"configured":true'; then
    echo -e "${GREEN}✅ ONLINE${NC} - Transcription service configured"
    echo "$TRANSCRIBE_STATUS" | jq -r '. | "   Model: \(.model)\n   Max File Size: \(.maxFileSize)\n   Formats: \(.supportedFormats | join(", "))"'
else
    echo -e "${RED}❌ OFFLINE${NC} - OPENAI_API_KEY not configured"
fi
echo ""

# Test 2: EMR Service Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  WebQx EMR Service (Medplum + Nextcloud)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EMR_STATUS=$(curl -s "${PROD_URL}/emr/status")
echo "$EMR_STATUS" | jq -r '
  . as $root |
  "   Status: \($root.status)" +
  "\n   Uptime: \($root.uptime_s)s" +
  "\n   Dependencies:" +
  "\n     • Medplum: \($root.dependencies.medplum.status)" +
  "\n     • Nextcloud: \($root.dependencies.nextcloud.status)"
'
echo ""

# Test 3: Overall Health
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Unified Server Health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HEALTH=$(curl -s "${PROD_URL}/health")
echo "$HEALTH" | jq -r '
  . as $root |
  "   Overall: \($root.status)" +
  "\n   Services:" +
  "\n     • Django: \(if $root.services.django then "✅" else "⏸️ " end)" +
  "\n     • OpenEMR: \(if $root.services.openemr then "✅" else "⏸️ " end)" +
  "\n     • Telehealth: \(if $root.services.telehealth then "✅" else "❌" end)" +
  "\n     • WebQx EMR: \(if $root.services.webqxEMR then "✅" else "❌" end)" +
  "\n     • Main Server: \(if $root.services.main then "✅" else "❌" end)" +
  (if .config then "\n   Configuration:\n     • Transcription: \(if $root.config.transcriptionConfigured then "✅" else "❌" end)" else "" end)
'
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                      Summary                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if echo "$TRANSCRIBE_STATUS" | grep -q '"configured":true'; then
    echo -e "${GREEN}✅ PRODUCTION READY${NC} - Voice transcription is working!"
    echo ""
    echo "📱 Test URLs:"
    echo "   • Demo Page: ${PROD_URL}/provider/webqx-emr-demo.html"
    echo "   • Telehealth: ${PROD_URL}/provider/telehealth-scheduling.html"
    echo ""
    echo "🎤 To test voice transcription:"
    echo "   1. Visit demo page"
    echo "   2. Click microphone icon"
    echo "   3. Allow browser microphone access"
    echo "   4. Speak clearly"
    echo "   5. Click Stop"
    echo "   6. Text appears automatically! ✨"
else
    echo -e "${YELLOW}⚠️  NEEDS CONFIGURATION${NC} - Add OPENAI_API_KEY to Railway"
    echo ""
    echo "To fix:"
    echo "   1. Get API key: https://platform.openai.com/api-keys"
    echo "   2. Add to Railway: Dashboard → Variables → OPENAI_API_KEY"
    echo "   3. Redeploy automatically"
    echo "   4. Run this test again"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
