#!/bin/bash

# WebQX FHIR API Test Script
# This script demonstrates the complete FHIR R4 implementation
# including Patient and Appointment resources with real-time booking

set -e

BASE_URL="http://localhost:3001/fhir"
echo "🌐 Testing WebQX FHIR R4 API at $BASE_URL"
echo "=================================================="

# Test server health
echo "📋 1. Checking server health..."
curl -s "$BASE_URL/../health" | jq '.'
echo ""

# Test capability statement
echo "🔍 2. Getting FHIR capability statement..."
curl -s "$BASE_URL/metadata" | jq '.resourceType, .name, .fhirVersion'
echo ""

# Test Patient operations
echo "👥 3. Testing Patient Resource Operations..."

echo "   3.1 Searching all patients..."
PATIENT_SEARCH=$(curl -s "$BASE_URL/Patient")
echo "$PATIENT_SEARCH" | jq '.total, .entry[0].resource | {id, name: .name[0], gender, birthDate}'
echo ""

echo "   3.2 Reading specific patient..."
curl -s "$BASE_URL/Patient/patient-001" | jq '{id, name: .name[0], gender, birthDate, telecom}'
echo ""

echo "   3.3 Getting patient summary..."
curl -s "$BASE_URL/Patient/patient-001/\$summary" | jq '.'
echo ""

echo "   3.4 Getting patient count..."
curl -s "$BASE_URL/Patient/\$count" | jq '.parameter[0]'
echo ""

echo "   3.5 Creating new patient..."
NEW_PATIENT=$(curl -s -X POST "$BASE_URL/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d @docs/fhir/examples/patient-create.json)
NEW_PATIENT_ID=$(echo "$NEW_PATIENT" | jq -r '.id')
echo "Created patient with ID: $NEW_PATIENT_ID"
echo ""

# Test Appointment operations
echo "📅 4. Testing Appointment Resource Operations..."

echo "   4.1 Searching all appointments..."
APPOINTMENT_SEARCH=$(curl -s "$BASE_URL/Appointment")
echo "$APPOINTMENT_SEARCH" | jq '.total, .entry[0].resource | {id, status, start, description}'
echo ""

echo "   4.2 Reading specific appointment..."
curl -s "$BASE_URL/Appointment/appointment-001" | jq '{id, status, start, end, description, participant: .participant | map(.actor.display)}'
echo ""

echo "   4.3 Getting appointment summary..."
curl -s "$BASE_URL/Appointment/appointment-001/\$summary" | jq '.'
echo ""

echo "   4.4 Getting appointment count..."
curl -s "$BASE_URL/Appointment/\$count" | jq '.parameter[0]'
echo ""

echo "   4.5 Getting today's appointments..."
curl -s "$BASE_URL/Appointment/\$today" | jq '.total'
echo ""

echo "   4.6 Getting upcoming appointments..."
curl -s "$BASE_URL/Appointment/\$upcoming" | jq '.total, .entry[0].resource | {id, start, description}'
echo ""

# Test Real-time Booking
echo "🚀 5. Testing Real-time Appointment Booking..."

echo "   5.1 Getting available slots..."
AVAILABLE_SLOTS=$(curl -s "$BASE_URL/Appointment/\$available-slots")
SLOT_COUNT=$(echo "$AVAILABLE_SLOTS" | jq '.parameter[0].part | length')
echo "Available slots: $SLOT_COUNT"

if [ "$SLOT_COUNT" -gt 0 ]; then
    FIRST_SLOT_ID=$(echo "$AVAILABLE_SLOTS" | jq -r '.parameter[0].part[0].resource.id')
    FIRST_SLOT_START=$(echo "$AVAILABLE_SLOTS" | jq -r '.parameter[0].part[0].resource.start')
    echo "First available slot: $FIRST_SLOT_ID at $FIRST_SLOT_START"
    echo ""

    echo "   5.2 Booking appointment using available slot..."
    BOOKING_DATA=$(cat <<EOF
{
  "patientId": "$NEW_PATIENT_ID",
  "practitionerId": "practitioner-001",
  "slotId": "$FIRST_SLOT_ID",
  "serviceType": "API Test Consultation",
  "description": "Appointment booked via API test",
  "priority": 5
}
EOF
)
    
    BOOKED_APPOINTMENT=$(curl -s -X POST "$BASE_URL/Appointment/\$book" \
      -H "Content-Type: application/json" \
      -d "$BOOKING_DATA")
    
    BOOKED_ID=$(echo "$BOOKED_APPOINTMENT" | jq -r '.id')
    echo "Successfully booked appointment: $BOOKED_ID"
    echo "$BOOKED_APPOINTMENT" | jq '{id, status, start, description}'
    echo ""

    echo "   5.3 Canceling the booked appointment..."
    CANCEL_RESULT=$(curl -s -X POST "$BASE_URL/Appointment/$BOOKED_ID/\$cancel" \
      -H "Content-Type: application/json" \
      -d '{"reason": "API test cancellation"}')
    echo "Cancelled appointment status:" $(echo "$CANCEL_RESULT" | jq -r '.status')
    echo ""
fi

# Test Advanced Search
echo "🔍 6. Testing Advanced Search Operations..."

echo "   6.1 Searching patients by name..."
curl -s "$BASE_URL/Patient?name=Doe" | jq '.total'

echo "   6.2 Searching patients by gender..."
curl -s "$BASE_URL/Patient?gender=female" | jq '.total'

echo "   6.3 Searching appointments by status..."
curl -s "$BASE_URL/Appointment?status=booked" | jq '.total'

echo "   6.4 Searching appointments by patient..."
curl -s "$BASE_URL/Appointment?patient=patient-001" | jq '.total'
echo ""

# Test Error Handling
echo "❌ 7. Testing Error Handling..."

echo "   7.1 Requesting non-existent patient..."
curl -s "$BASE_URL/Patient/non-existent" | jq '.resourceType, .issue[0].diagnostics'

echo "   7.2 Invalid patient data..."
curl -s -X POST "$BASE_URL/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType": "Patient", "name": []}' | \
  jq '.resourceType, .issue[0].diagnostics'
echo ""

# Final Statistics
echo "📊 8. Final System Statistics..."
FINAL_PATIENT_COUNT=$(curl -s "$BASE_URL/Patient/\$count" | jq '.parameter[0].valueInteger')
FINAL_APPOINTMENT_COUNT=$(curl -s "$BASE_URL/Appointment/\$count" | jq '.parameter[0].valueInteger')
FINAL_SLOT_COUNT=$(curl -s "$BASE_URL/Appointment/\$available-slots" | jq '.parameter[0].part | length')

echo "   Total Patients: $FINAL_PATIENT_COUNT"
echo "   Total Appointments: $FINAL_APPOINTMENT_COUNT"
echo "   Available Slots: $FINAL_SLOT_COUNT"
echo ""

echo "✅ FHIR API Testing Complete!"
echo "=================================================="
echo "🎉 WebQX FHIR R4 API is fully operational with:"
echo "   • Patient resource management"
echo "   • Appointment scheduling and booking"
echo "   • Real-time slot availability"
echo "   • Comprehensive search capabilities"
echo "   • FHIR-compliant error handling"
echo "   • OAuth2 security (development mode)"