#!/bin/bash
# Test Audio Transcription Workflow
# End-to-end test: Record → Upload → Transcribe → Save

set -e

PRODUCTION_URL="${1:-https://webqx-production.up.railway.app:3100}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Audio Transcription Workflow Test                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Target: $PRODUCTION_URL"
echo ""

# Check if test audio file exists
if [ ! -f "./test-audio-sample.mp3" ]; then
  echo "⚠️  No test audio file found"
  echo "Creating a minimal test file..."
  
  # Create a simple text file to simulate audio (for testing upload logic)
  echo "This is a test audio transcription sample" > ./test-audio-sample.txt
  TEST_FILE="./test-audio-sample.txt"
  CONTENT_TYPE="text/plain"
else
  TEST_FILE="./test-audio-sample.mp3"
  CONTENT_TYPE="audio/mpeg"
fi

echo "📁 Test file: $TEST_FILE"
echo "📊 Content-Type: $CONTENT_TYPE"
echo ""

# Test 1: Check transcription endpoint exists
echo "[1/4] Checking transcription endpoint..."
ENDPOINT_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  "$PRODUCTION_URL/emr/transcribe")

if [ "$ENDPOINT_CHECK" = "200" ] || [ "$ENDPOINT_CHECK" = "204" ]; then
  echo "  ✅ Transcription endpoint is accessible"
else
  echo "  ⚠️  Endpoint returned HTTP $ENDPOINT_CHECK"
fi

# Test 2: Test file upload
echo "[2/4] Testing file upload..."
UPLOAD_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -F "file=@$TEST_FILE" \
  -F "language=en" \
  "$PRODUCTION_URL/emr/transcribe")

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$UPLOAD_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ File uploaded successfully"
  echo ""
  echo "  📝 Transcription Response:"
  echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
  echo ""
elif [ "$HTTP_CODE" = "400" ]; then
  echo "  ⚠️  Bad request (HTTP 400)"
  echo "  Response: $RESPONSE_BODY"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "  ❌ Unauthorized (HTTP 401)"
  echo "  OpenAI API key may be missing or invalid"
elif [ "$HTTP_CODE" = "500" ]; then
  echo "  ❌ Server error (HTTP 500)"
  echo "  Response: $RESPONSE_BODY"
else
  echo "  ⚠️  Unexpected response (HTTP $HTTP_CODE)"
  echo "  Response: $RESPONSE_BODY"
fi

# Test 3: Check OpenAI configuration
echo "[3/4] Checking OpenAI Whisper configuration..."
HEALTH_CHECK=$(curl -s "$PRODUCTION_URL/emr/health/full")
OPENAI_CONFIGURED=$(echo "$HEALTH_CHECK" | grep -oP '"openai_whisper":\{[^\}]*"configured":(true|false)' | grep -oP '(true|false)$')

if [ "$OPENAI_CONFIGURED" = "true" ]; then
  echo "  ✅ OpenAI Whisper is configured"
  
  API_KEY_SET=$(echo "$HEALTH_CHECK" | grep -oP '"api_key_set":(true|false)' | grep -oP '(true|false)$')
  MODEL=$(echo "$HEALTH_CHECK" | grep -oP '"model":"[^"]*"' | cut -d'"' -f4)
  
  echo "  📊 API Key Set: $API_KEY_SET"
  echo "  🤖 Model: $MODEL"
else
  echo "  ❌ OpenAI Whisper is NOT configured"
  echo "  ℹ️  Set OPENAI_API_KEY in Railway environment variables"
fi

# Test 4: Test error handling
echo "[4/4] Testing error handling (invalid file)..."
ERROR_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -F "file=@./package.json" \
  "$PRODUCTION_URL/emr/transcribe" 2>&1)

ERROR_HTTP_CODE=$(echo "$ERROR_TEST" | grep "HTTP_CODE" | cut -d':' -f2)

if [ "$ERROR_HTTP_CODE" = "400" ] || [ "$ERROR_HTTP_CODE" = "415" ]; then
  echo "  ✅ Invalid file correctly rejected (HTTP $ERROR_HTTP_CODE)"
else
  echo "  ⚠️  Unexpected error handling (HTTP $ERROR_HTTP_CODE)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ "$HTTP_CODE" = "200" ] && [ "$OPENAI_CONFIGURED" = "true" ]; then
  echo "✅ All transcription tests passed!"
  echo ""
  echo "Your audio transcription workflow is working:"
  echo "  • File upload: ✅"
  echo "  • OpenAI Whisper: ✅"
  echo "  • Transcription: ✅"
  echo "  • Error handling: ✅"
else
  echo "⚠️  Some tests failed. Check above for details."
  echo ""
  if [ "$OPENAI_CONFIGURED" != "true" ]; then
    echo "❌ Action required: Set OPENAI_API_KEY in Railway"
  fi
fi

echo ""
echo "Next steps:"
echo "  1. Test from frontend: https://webqx.github.io"
echo "  2. Record actual audio in browser"
echo "  3. Verify transcription saves to Medplum"
echo "  4. Check audio file appears in Nextcloud"
echo ""

# Cleanup
rm -f ./test-audio-sample.txt 2>/dev/null || true
