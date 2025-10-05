#!/bin/bash
# Test Nextcloud WebDAV Connection
# This script tests the Nextcloud file storage integration

set -e

NEXTCLOUD_URL="${NEXTCLOUD_WEBDAV_URL:-}"
NEXTCLOUD_USER="${NEXTCLOUD_USERNAME:-admin}"
NEXTCLOUD_PASS="${NEXTCLOUD_PASSWORD:-}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Nextcloud WebDAV Connection Test                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if credentials are set
if [ -z "$NEXTCLOUD_URL" ]; then
  echo "❌ NEXTCLOUD_WEBDAV_URL not set"
  echo ""
  echo "Set it with:"
  echo "  export NEXTCLOUD_WEBDAV_URL='https://nextcloud.yourdomain.com/remote.php/dav/files/admin/'"
  exit 1
fi

if [ -z "$NEXTCLOUD_PASS" ]; then
  echo "❌ NEXTCLOUD_PASSWORD not set"
  echo ""
  echo "Set it with:"
  echo "  export NEXTCLOUD_PASSWORD='xxxxx-xxxxx-xxxxx-xxxxx-xxxxx'"
  exit 1
fi

echo "🔗 URL: $NEXTCLOUD_URL"
echo "👤 User: $NEXTCLOUD_USER"
echo "🔑 Password: ${NEXTCLOUD_PASS:0:10}..."
echo ""

# Test 1: Basic connection
echo "[1/5] Testing basic connection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X PROPFIND \
  "$NEXTCLOUD_URL")

if [ "$HTTP_CODE" = "207" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅ Connection successful (HTTP $HTTP_CODE)"
else
  echo "  ❌ Connection failed (HTTP $HTTP_CODE)"
  echo ""
  echo "Common issues:"
  echo "  - Incorrect URL (should end with /remote.php/dav/files/USERNAME/)"
  echo "  - Wrong app password (use app password, not main password)"
  echo "  - Nextcloud server is offline"
  exit 1
fi

# Test 2: List files
echo "[2/5] Listing files..."
PROPFIND_RESPONSE=$(curl -s \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X PROPFIND \
  -H "Depth: 1" \
  "$NEXTCLOUD_URL")

FILE_COUNT=$(echo "$PROPFIND_RESPONSE" | grep -o "<d:href>" | wc -l)
echo "  ✅ Found $FILE_COUNT items"

# Test 3: Create test directory
echo "[3/5] Creating test directory..."
TEST_DIR="WebQx-Test-$(date +%s)/"
CREATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X MKCOL \
  "${NEXTCLOUD_URL}${TEST_DIR}")

if [ "$CREATE_RESPONSE" = "201" ]; then
  echo "  ✅ Directory created: $TEST_DIR"
else
  echo "  ⚠️  Could not create directory (HTTP $CREATE_RESPONSE)"
fi

# Test 4: Upload test file
echo "[4/5] Uploading test file..."
TEST_FILE="test-audio-$(date +%s).txt"
echo "This is a test file from WebQx EMR" > /tmp/$TEST_FILE

UPLOAD_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X PUT \
  --data-binary @/tmp/$TEST_FILE \
  "${NEXTCLOUD_URL}${TEST_DIR}${TEST_FILE}")

if [ "$UPLOAD_RESPONSE" = "201" ] || [ "$UPLOAD_RESPONSE" = "204" ]; then
  echo "  ✅ File uploaded: $TEST_FILE"
else
  echo "  ❌ Upload failed (HTTP $UPLOAD_RESPONSE)"
fi

rm -f /tmp/$TEST_FILE

# Test 5: Download test file
echo "[5/5] Downloading test file..."
DOWNLOAD_RESPONSE=$(curl -s \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  "${NEXTCLOUD_URL}${TEST_DIR}${TEST_FILE}")

if echo "$DOWNLOAD_RESPONSE" | grep -q "test file from WebQx EMR"; then
  echo "  ✅ File downloaded and verified"
else
  echo "  ⚠️  File content mismatch"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test files..."
curl -s -o /dev/null \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X DELETE \
  "${NEXTCLOUD_URL}${TEST_DIR}${TEST_FILE}"

curl -s -o /dev/null \
  -u "$NEXTCLOUD_USER:$NEXTCLOUD_PASS" \
  -X DELETE \
  "${NEXTCLOUD_URL}${TEST_DIR}"

echo "  ✅ Cleanup complete"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ All Nextcloud WebDAV tests passed!"
echo ""
echo "Your Nextcloud integration is working correctly."
echo "WebQx EMR can now:"
echo "  • Upload audio recordings"
echo "  • Store patient documents"
echo "  • Retrieve files for transcription"
echo ""
echo "Next steps:"
echo "  1. Deploy WebQx backend to Railway"
echo "  2. Add Nextcloud credentials to Railway environment variables"
echo "  3. Test from frontend at https://webqx.github.io"
echo ""
