#!/bin/bash
# Railway Variables Management Script
# Uses Railway GraphQL API to list and manage environment variables

set -e

# Check if Railway token is set
if [ -z "$RAILWAY_TOKEN" ]; then
    echo "❌ Error: RAILWAY_TOKEN environment variable not set"
    echo "   Set it with: export RAILWAY_TOKEN=your_token_here"
    exit 1
fi

RAILWAY_API="https://backboard.railway.app/graphql/v2"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Railway Environment Variables                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# First, we need to get the project ID and environment ID
# Let's try to list projects first
echo "🔍 Fetching Railway projects..."
echo ""

PROJECTS_QUERY='{
  "query": "query { projects { edges { node { id name services { edges { node { id name } } } } } } }"
}'

RESPONSE=$(curl -s -X POST "$RAILWAY_API" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PROJECTS_QUERY")

echo "$RESPONSE" | jq '.' || echo "$RESPONSE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If you see projects above, we can proceed to list variables."
echo "Otherwise, the RAILWAY_TOKEN might not have sufficient permissions."
echo ""
echo "To manually check variables:"
echo "  1. Go to https://railway.app/dashboard"
echo "  2. Select your project"
echo "  3. Click on your service"
echo "  4. Go to Variables tab"
echo ""
