#!/bin/bash

BASE_URL="http://localhost:5055/api"
ADMIN_EMAIL="admin@noun.edu.ng"
STAFF_EMAIL="registry@noun.edu.ng"
PASSWORD="password123"

echo "1. Login as Admin..."
ADMIN_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\", \"password\":\"$PASSWORD\", \"loginType\":\"ADMIN\"}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "Admin Login Failed"
    exit 1
fi
echo "Admin Token Acquired"

echo "2. Run Payroll (Jan 2025)..."
curl -s -X POST $BASE_URL/payroll/run \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month":"January", "year":2025}'
echo -e "\n"

echo "3. Get Payroll Stats..."
curl -s -X GET $BASE_URL/payroll/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo -e "\n"

echo "4. Login as Staff..."
STAFF_TOKEN=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$STAFF_EMAIL\", \"password\":\"$PASSWORD\", \"loginType\":\"NV\"}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$STAFF_TOKEN" ]; then
    echo "Staff Login Failed"
    exit 1
fi
echo "Staff Token Acquired"

echo "5. Get My Payslips..."
curl -s -X GET $BASE_URL/payroll/me \
  -H "Authorization: Bearer $STAFF_TOKEN"
echo -e "\n"

echo "6. Add Publication..."
curl -s -X POST $BASE_URL/academic/publications \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"API Verification Study", "year":2025, "citation":"Test Citation", "type":"ARTICLE"}'
echo -e "\n"

echo "7. Check Sabbatical Eligibility..."
curl -s -X GET $BASE_URL/academic/sabbatical/eligibility \
  -H "Authorization: Bearer $STAFF_TOKEN"
echo -e "\n"
