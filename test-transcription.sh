#!/bin/bash
# Test script for production transcription endpoint

echo "================================================"
echo "🎤 OpenAI Whisper Transcription Test"
echo "================================================"
echo ""

PRODUCTION_URL="https://webqx-production.up.railway.app"

# Test 1: Check transcription service status
echo "✅ Test 1: Checking transcription service status..."
curl -s "${PRODUCTION_URL}/emr/transcribe/status" | jq '.'
echo ""

# Test 2: Check overall EMR status
echo "✅ Test 2: Checking WebQx EMR service status..."
curl -s "${PRODUCTION_URL}/emr/status" | jq '.'
echo ""

# Test 3: Check unified server health
echo "✅ Test 3: Checking unified server health..."
curl -s "${PRODUCTION_URL}/health" | jq '.'
echo ""

echo "================================================"
echo "📋 Test Summary"
echo "================================================"
echo ""
echo "If you see:"
echo "  • transcription service 'status': 'online' ✅"
echo "  • 'configured': true ✅"
echo "  • 'model': 'whisper-1' ✅"
echo ""
echo "Then transcription is READY!"
echo ""
echo "To test with actual audio file:"
echo "  curl -X POST ${PRODUCTION_URL}/emr/transcribe \\"
echo "    -F 'file=@your-audio.mp3' \\"
echo "    -F 'language=en'"
echo ""
echo "================================================"
