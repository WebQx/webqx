#!/bin/bash

# CI/CD Integration Test Script
# Tests all three applications locally before deployment

echo "🔧 Running CI/CD Integration Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a URL returns expected content
check_health_endpoint() {
    local url=$1
    local expected=$2
    local name=$3
    
    echo -n "Testing $name health endpoint... "
    
    if curl -s -f "$url" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

# Test Node.js application (assuming it runs on default port 3000)
echo -e "\n${YELLOW}1. Testing Node.js Application${NC}"
cd /home/runner/work/webqx/webqx
npm ci &>/dev/null

# Start Node.js server in background
timeout 15s npm start &
NODE_PID=$!
sleep 8

if check_health_endpoint "http://localhost:3000/health" "healthy" "Node.js"; then
    echo "   Node.js application is working correctly"
else
    echo "   Warning: Node.js health check failed or server not responding"
fi

# Clean up Node.js process
kill $NODE_PID 2>/dev/null || true

# Test Python application
echo -e "\n${YELLOW}2. Testing Python Application${NC}"
cd /home/runner/work/webqx/webqx/python-app

# Set up Python environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt &>/dev/null

# Run Python tests
echo -n "Running Python tests... "
if python -m pytest test_app.py -v &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Start Python server in background
timeout 10s python app.py &
PYTHON_PID=$!
sleep 5

if check_health_endpoint "http://localhost:5000/" "healthy" "Python"; then
    echo "   Python application is working correctly"
else
    echo "   Warning: Python health check failed or server not responding"
fi

# Clean up Python process
kill $PYTHON_PID 2>/dev/null || true
deactivate

# Test Ruby application
echo -e "\n${YELLOW}3. Testing Ruby Application${NC}"
cd /home/runner/work/webqx/webqx/ruby-app

# Set up Ruby environment
export PATH="$HOME/.local/share/gem/ruby/3.2.0/bin:$PATH"
bundle config set path vendor/bundle &>/dev/null
bundle install &>/dev/null

# Run Ruby tests
echo -n "Running Ruby tests... "
if bundle exec rspec spec/ &>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Start Ruby server in background
timeout 10s bundle exec ruby app.rb &
RUBY_PID=$!
sleep 5

if check_health_endpoint "http://localhost:4567/" "healthy" "Ruby"; then
    echo "   Ruby application is working correctly"
else
    echo "   Warning: Ruby health check failed or server not responding"
fi

# Clean up Ruby process
kill $RUBY_PID 2>/dev/null || true

echo -e "\n${GREEN}🎉 CI/CD Integration tests completed!${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Configure GitHub Secrets for Heroku deployment"
echo "2. Create Heroku applications for each environment"
echo "3. Push to main branch to trigger automated deployment"
echo ""
echo "See CI_CD_SETUP.md for detailed configuration instructions."