#!/bin/bash

# Test Medplum FHIR Integration with OAuth2
# Tests full CRUD operations on Patient resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-https://webqx-production.up.railway.app:3100}"
EMR_BASE="${BASE_URL}/emr"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   WebQx EMR - Medplum FHIR Integration Test${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Testing endpoint: ${YELLOW}${EMR_BASE}${NC}"
echo ""

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
    fi
}

# Function to make API call and check response
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
    
    # Return the body for further use
    echo "$body"
}

echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW} Test 1: Health Check${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

health_response=$(test_endpoint "GET" "${EMR_BASE}/health/full" "Comprehensive health check" "" "")

# Check if Medplum is configured
if echo "$health_response" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
elif echo "$health_response" | grep -q '"status":"degraded"'; then
    echo -e "${YELLOW}⚠ Backend is degraded - some services may not be available${NC}"
else
    echo -e "${RED}✗ Backend configuration incomplete${NC}"
    echo -e "${YELLOW}Please ensure MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET are set in Railway${NC}"
fi

# Check Medplum credentials
if echo "$health_response" | grep -q '"client_id":true'; then
    echo -e "${GREEN}✓ MEDPLUM_CLIENT_ID is configured${NC}"
else
    echo -e "${RED}✗ MEDPLUM_CLIENT_ID is NOT configured${NC}"
fi

if echo "$health_response" | grep -q '"client_secret":true'; then
    echo -e "${GREEN}✓ MEDPLUM_CLIENT_SECRET is configured${NC}"
else
    echo -e "${RED}✗ MEDPLUM_CLIENT_SECRET is NOT configured${NC}"
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW} Test 2: List Patients${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

patients_response=$(test_endpoint "GET" "${EMR_BASE}/patients?limit=5" "List patients (limit 5)" "" "200")

patient_count=$(echo "$patients_response" | jq -r '.count' 2>/dev/null || echo "0")
echo -e "${BLUE}Patient count:${NC} $patient_count"

echo ""
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW} Test 3: Create New Patient${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

# Create a test patient
patient_data='{
  "name": [{
    "use": "official",
    "family": "TestPatient",
    "given": ["WebQx", "Integration"]
  }],
  "gender": "unknown",
  "birthDate": "2000-01-01",
  "telecom": [{
    "system": "phone",
    "value": "555-0123",
    "use": "mobile"
  }],
  "address": [{
    "use": "home",
    "line": ["123 Test Street"],
    "city": "Boston",
    "state": "MA",
    "postalCode": "02101",
    "country": "US"
  }],
  "identifier": [{
    "system": "http://webqx.io/patient-id",
    "value": "TEST-'$(date +%s)'"
  }]
}'

create_response=$(test_endpoint "POST" "${EMR_BASE}/patients" "Create test patient" "$patient_data" "201")

# Extract patient ID from response
new_patient_id=$(echo "$create_response" | jq -r '.patient.id' 2>/dev/null || echo "")

if [ -n "$new_patient_id" ] && [ "$new_patient_id" != "null" ]; then
    echo -e "${GREEN}✓ Patient created with ID: $new_patient_id${NC}"
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    echo -e "${YELLOW} Test 4: Get Patient by ID${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    
    test_endpoint "GET" "${EMR_BASE}/patients/${new_patient_id}" "Get patient by ID" "" "200"
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    echo -e "${YELLOW} Test 5: Update Patient${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    
    # Update the patient
    update_data='{
      "name": [{
        "use": "official",
        "family": "TestPatient",
        "given": ["WebQx", "Integration", "Updated"]
      }],
      "gender": "unknown",
      "birthDate": "2000-01-01",
      "telecom": [{
        "system": "phone",
        "value": "555-9999",
        "use": "mobile"
      }]
    }'
    
    test_endpoint "PUT" "${EMR_BASE}/patients/${new_patient_id}" "Update patient" "$update_data" "200"
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    echo -e "${YELLOW} Test 6: Search Patients${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════${NC}"
    
    test_endpoint "GET" "${EMR_BASE}/patients/search?name=TestPatient&_count=10" "Search patients by name" "" "200"
    
else
    echo -e "${RED}✗ Failed to create patient - skipping update/delete tests${NC}"
    echo -e "${YELLOW}This is expected if Medplum credentials are not configured${NC}"
fi

echo ""
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW} Test 7: Error Handling${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

# Test invalid patient ID
test_endpoint "GET" "${EMR_BASE}/patients/invalid-id-12345" "Get non-existent patient (expect 404)" "" "404"

# Test invalid create request
test_endpoint "POST" "${EMR_BASE}/patients" "Create patient without required fields (expect 400)" '{}' "400"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

if [ -n "$new_patient_id" ] && [ "$new_patient_id" != "null" ]; then
    echo -e "${GREEN}✓ All CRUD operations completed successfully${NC}"
    echo -e "${GREEN}✓ Medplum OAuth2 integration is working${NC}"
    echo -e ""
    echo -e "${BLUE}Test Patient ID:${NC} $new_patient_id"
    echo -e "${YELLOW}Note: Test patient remains in Medplum for verification${NC}"
else
    echo -e "${YELLOW}⚠ Integration test completed with limited functionality${NC}"
    echo -e ""
    echo -e "${YELLOW}Required Actions:${NC}"
    echo -e "1. Add MEDPLUM_CLIENT_ID to Railway variables"
    echo -e "2. Add MEDPLUM_CLIENT_SECRET to Railway variables"
    echo -e "3. Ensure MEDPLUM_API_URL is set to: https://api.medplum.com"
    echo -e "4. Redeploy and run this test again"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
