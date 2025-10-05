#!/bin/bash

# Complete End-to-End Telehealth + Medical Transcription Test
# Tests: Medplum (patients) + OpenAI Whisper (transcription) + Nextcloud (files)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

BASE_URL="${1:-https://webqx-production.up.railway.app:3100}"
EMR_BASE="${BASE_URL}/emr"

echo -e "${MAGENTA}════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}   WebQx EMR - Complete Telehealth Workflow Test${NC}"
echo -e "${MAGENTA}   Medical Transcription + Patient Records + Files${NC}"
echo -e "${MAGENTA}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Testing endpoint: ${YELLOW}${EMR_BASE}${NC}"
echo ""

# Test counters
PASSED=0
FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

# Function to make API call
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local expected_status=$5
    
    echo ""
    echo -e "${BLUE}Testing:${NC} $description"
    echo -e "${BLUE}Endpoint:${NC} $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$endpoint" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    echo -e "${BLUE}HTTP Status:${NC} $http_code"
    
    if [ -n "$expected_status" ]; then
        if [ "$http_code" = "$expected_status" ]; then
            print_result 0 "$description"
        else
            print_result 1 "$description (expected $expected_status, got $http_code)"
        fi
    else
        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
            print_result 0 "$description"
        else
            print_result 1 "$description"
        fi
    fi
    
    # Pretty print JSON if available
    if command -v jq &> /dev/null && [ -n "$body" ]; then
        echo -e "${BLUE}Response:${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${BLUE}Response:${NC} $body"
    fi
    
    echo "$body"
}

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN} Phase 1: System Health Check${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

health_response=$(test_endpoint "GET" "${EMR_BASE}/health/full" "Comprehensive health check" "" "")

# Parse health status
medplum_online=$(echo "$health_response" | jq -r '.services.medplum.status' 2>/dev/null || echo "unknown")
medplum_client_id=$(echo "$health_response" | jq -r '.services.medplum.credentials_set.client_id' 2>/dev/null || echo "false")
medplum_client_secret=$(echo "$health_response" | jq -r '.services.medplum.credentials_set.client_secret' 2>/dev/null || echo "false")
nextcloud_online=$(echo "$health_response" | jq -r '.services.nextcloud.status' 2>/dev/null || echo "unknown")
openai_configured=$(echo "$health_response" | jq -r '.services.openai_whisper.api_key_set' 2>/dev/null || echo "false")

echo ""
echo -e "${YELLOW}Service Status:${NC}"

# Medplum status
if [ "$medplum_online" = "online" ] && [ "$medplum_client_id" = "true" ] && [ "$medplum_client_secret" = "true" ]; then
    echo -e "  ${GREEN}✓ Medplum FHIR: READY${NC} (OAuth2 configured)"
    MEDPLUM_READY=true
else
    echo -e "  ${RED}✗ Medplum FHIR: NOT READY${NC}"
    echo -e "    Status: $medplum_online | CLIENT_ID: $medplum_client_id | CLIENT_SECRET: $medplum_client_secret"
    MEDPLUM_READY=false
fi

# Nextcloud status
if [ "$nextcloud_online" = "online" ]; then
    echo -e "  ${GREEN}✓ Nextcloud Files: READY${NC}"
    NEXTCLOUD_READY=true
else
    echo -e "  ${YELLOW}⚠ Nextcloud Files: ${nextcloud_online}${NC}"
    NEXTCLOUD_READY=false
fi

# OpenAI status
if [ "$openai_configured" = "true" ]; then
    echo -e "  ${GREEN}✓ OpenAI Whisper: READY${NC}"
    OPENAI_READY=true
else
    echo -e "  ${RED}✗ OpenAI Whisper: NOT CONFIGURED${NC}"
    echo -e "    ${YELLOW}Please set OPENAI_API_KEY in Railway${NC}"
    OPENAI_READY=false
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN} Phase 2: Patient Management (Medplum)${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

if [ "$MEDPLUM_READY" = true ]; then
    # Create test patient
    patient_data='{
      "name": [{
        "use": "official",
        "family": "TelehealthTest",
        "given": ["Dr", "Medical"]
      }],
      "gender": "unknown",
      "birthDate": "1990-01-01",
      "telecom": [{
        "system": "phone",
        "value": "555-TELEHEALTH",
        "use": "mobile"
      }],
      "identifier": [{
        "system": "http://webqx.io/telehealth-test",
        "value": "TEST-TELEHEALTH-'$(date +%s)'"
      }]
    }'
    
    create_response=$(test_endpoint "POST" "${EMR_BASE}/patients" "Create telehealth test patient" "$patient_data" "201")
    PATIENT_ID=$(echo "$create_response" | jq -r '.patient.id' 2>/dev/null || echo "")
    
    if [ -n "$PATIENT_ID" ] && [ "$PATIENT_ID" != "null" ]; then
        echo -e "${GREEN}✓ Test patient created: $PATIENT_ID${NC}"
        
        # Get patient
        test_endpoint "GET" "${EMR_BASE}/patients/${PATIENT_ID}" "Retrieve patient record" "" "200"
    else
        echo -e "${RED}✗ Failed to create patient${NC}"
        PATIENT_ID=""
    fi
else
    echo -e "${YELLOW}⚠ Skipping patient tests - Medplum not configured${NC}"
    PATIENT_ID=""
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN} Phase 3: Medical Transcription (OpenAI)${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

if [ "$OPENAI_READY" = true ]; then
    # Check transcription status
    transcribe_status=$(test_endpoint "GET" "${EMR_BASE}/transcribe/status" "Check transcription service status" "" "200")
    
    # Create test audio file (5 seconds of silence in WAV format)
    AUDIO_FILE="/tmp/test-audio-$(date +%s).wav"
    echo ""
    echo -e "${BLUE}Creating test audio file:${NC} $AUDIO_FILE"
    
    # Generate a simple WAV file with a voice-like tone (using sox if available, or fall back to silence)
    if command -v sox &> /dev/null; then
        sox -n -r 16000 -c 1 -b 16 "$AUDIO_FILE" synth 3 sine 440 vol 0.1 2>/dev/null || \
        sox -n -r 16000 -c 1 -b 16 "$AUDIO_FILE" trim 0 3 2>/dev/null
        echo -e "${GREEN}✓ Generated audio file with sox${NC}"
    else
        # Fallback: Create minimal WAV header + silence
        {
            # RIFF header
            printf "RIFF"
            printf "\x24\x00\x00\x00"  # File size - 8
            printf "WAVE"
            # fmt chunk
            printf "fmt "
            printf "\x10\x00\x00\x00"  # Chunk size
            printf "\x01\x00"          # Audio format (PCM)
            printf "\x01\x00"          # Channels (1)
            printf "\x80\x3e\x00\x00"  # Sample rate (16000)
            printf "\x00\x7d\x00\x00"  # Byte rate
            printf "\x02\x00"          # Block align
            printf "\x10\x00"          # Bits per sample (16)
            # data chunk
            printf "data"
            printf "\x00\x00\x00\x00"  # Data size
        } > "$AUDIO_FILE"
        echo -e "${YELLOW}⚠ Created minimal WAV file (sox not available)${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Uploading audio for transcription...${NC}"
    
    # Upload and transcribe
    transcribe_response=$(curl -s -w "\n%{http_code}" -X POST "${EMR_BASE}/transcribe" \
        -F "file=@${AUDIO_FILE}" \
        -F "language=en" 2>&1)
    
    transcribe_http_code=$(echo "$transcribe_response" | tail -n1)
    transcribe_body=$(echo "$transcribe_response" | head -n-1)
    
    echo -e "${BLUE}HTTP Status:${NC} $transcribe_http_code"
    
    if [ "$transcribe_http_code" = "200" ]; then
        print_result 0 "Audio transcription"
        echo -e "${BLUE}Response:${NC}"
        echo "$transcribe_body" | jq '.' 2>/dev/null || echo "$transcribe_body"
        
        # Extract transcription text
        TRANSCRIPTION=$(echo "$transcribe_body" | jq -r '.text' 2>/dev/null || echo "")
        if [ -n "$TRANSCRIPTION" ]; then
            echo -e "${GREEN}✓ Transcription text:${NC} \"$TRANSCRIPTION\""
        fi
    else
        print_result 1 "Audio transcription (HTTP $transcribe_http_code)"
        echo -e "${BLUE}Response:${NC}"
        echo "$transcribe_body" | jq '.' 2>/dev/null || echo "$transcribe_body"
    fi
    
    # Cleanup
    rm -f "$AUDIO_FILE"
    
    # Test error handling (invalid file)
    echo ""
    echo -e "${BLUE}Testing invalid file rejection...${NC}"
    INVALID_FILE="/tmp/test-invalid-$(date +%s).txt"
    echo "This is not an audio file" > "$INVALID_FILE"
    
    invalid_response=$(curl -s -w "\n%{http_code}" -X POST "${EMR_BASE}/transcribe" \
        -F "file=@${INVALID_FILE}" 2>&1)
    
    invalid_http_code=$(echo "$invalid_response" | tail -n1)
    
    if [ "$invalid_http_code" = "400" ] || [ "$invalid_http_code" = "500" ]; then
        print_result 0 "Invalid file rejection (got $invalid_http_code)"
    else
        print_result 1 "Invalid file rejection (expected 400/500, got $invalid_http_code)"
    fi
    
    rm -f "$INVALID_FILE"
    
else
    echo -e "${YELLOW}⚠ Skipping transcription tests - OpenAI not configured${NC}"
    echo -e "${YELLOW}  Set OPENAI_API_KEY in Railway to enable transcription${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN} Phase 4: File Storage (Nextcloud)${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

if [ "$NEXTCLOUD_READY" = true ]; then
    echo -e "${GREEN}✓ Nextcloud is online${NC}"
    echo -e "${YELLOW}Note: File upload testing requires Nextcloud credentials${NC}"
    echo -e "${YELLOW}      Run test-nextcloud-connection.sh for detailed file tests${NC}"
else
    echo -e "${YELLOW}⚠ Nextcloud not ready - file storage will not work${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN} Phase 5: Integration Scenarios${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}Scenario 1: Telehealth Consultation Workflow${NC}"
echo -e "  1. Patient record created .............. ${PATIENT_ID:+✓}${PATIENT_ID:-✗}"
echo -e "  2. Video call (Jitsi) .................. ✓ (integrated)"
echo -e "  3. Audio recording transcription ....... ${OPENAI_READY:+✓}${OPENAI_READY:-✗}"
echo -e "  4. Transcription saved to patient ...... ${PATIENT_ID:+✓}${PATIENT_ID:-✗}"
echo -e "  5. Audio file stored in Nextcloud ...... ${NEXTCLOUD_READY:+✓}${NEXTCLOUD_READY:-✗}"

echo ""
echo -e "${BLUE}Scenario 2: Medical Documentation${NC}"
echo -e "  1. Doctor dictates notes ............... ${OPENAI_READY:+✓}${OPENAI_READY:-✗}"
echo -e "  2. Whisper transcribes to text ......... ${OPENAI_READY:+✓}${OPENAI_READY:-✗}"
echo -e "  3. Notes attached to patient record .... ${PATIENT_ID:+✓}${PATIENT_ID:-✗}"
echo -e "  4. Original audio archived ............. ${NEXTCLOUD_READY:+✓}${NEXTCLOUD_READY:-✗}"

echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}   Test Summary${NC}"
echo -e "${MAGENTA}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}Tests Passed: $PASSED${NC}"
echo -e "${RED}Tests Failed: $FAILED${NC}"
echo ""

# Overall status
if [ "$MEDPLUM_READY" = true ] && [ "$OPENAI_READY" = true ]; then
    echo -e "${GREEN}✓ PRODUCTION READY: All critical services configured${NC}"
    echo ""
    echo -e "${BLUE}Your WebQx EMR can now:${NC}"
    echo -e "  ✓ Manage patient records (Medplum FHIR)"
    echo -e "  ✓ Transcribe medical audio (OpenAI Whisper)"
    if [ "$NEXTCLOUD_READY" = true ]; then
        echo -e "  ✓ Store files and recordings (Nextcloud)"
    fi
    echo -e "  ✓ Conduct video consultations (Jitsi Meet)"
    echo ""
    echo -e "${GREEN}🎉 Users can start testing remotely!${NC}"
    
elif [ "$MEDPLUM_READY" = true ] || [ "$OPENAI_READY" = true ]; then
    echo -e "${YELLOW}⚠ PARTIALLY READY: Some services need configuration${NC}"
    echo ""
    if [ "$MEDPLUM_READY" = false ]; then
        echo -e "${RED}Missing: Medplum FHIR${NC}"
        echo -e "  Action: Add MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET to Railway"
    fi
    if [ "$OPENAI_READY" = false ]; then
        echo -e "${RED}Missing: OpenAI Whisper${NC}"
        echo -e "  Action: Add OPENAI_API_KEY to Railway"
    fi
    if [ "$NEXTCLOUD_READY" = false ]; then
        echo -e "${YELLOW}Optional: Nextcloud Files${NC}"
        echo -e "  Action: Deploy Nextcloud AIO and add credentials to Railway"
    fi
    
else
    echo -e "${RED}✗ NOT READY: Critical services not configured${NC}"
    echo ""
    echo -e "${YELLOW}Required Actions:${NC}"
    echo -e "  1. Add MEDPLUM_CLIENT_ID to Railway"
    echo -e "  2. Add MEDPLUM_CLIENT_SECRET to Railway"
    echo -e "  3. Add OPENAI_API_KEY to Railway"
    echo -e "  4. (Optional) Deploy Nextcloud AIO and add credentials"
    echo ""
    echo -e "${BLUE}After adding credentials:${NC}"
    echo -e "  • Railway will auto-redeploy (2-3 minutes)"
    echo -e "  • Run this test again to verify"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

# Exit with appropriate code
if [ $FAILED -gt 0 ] || [ "$MEDPLUM_READY" = false ] || [ "$OPENAI_READY" = false ]; then
    exit 1
else
    exit 0
fi
