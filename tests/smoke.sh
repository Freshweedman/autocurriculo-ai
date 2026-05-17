#!/bin/bash
# ===================================================
# AutoCurriculo AI - Deployment Smoke Tests
# Usage: bash tests/smoke.sh [VERCEL_URL]
# Default: https://placeholder.vercel.app
# ===================================================

VERCEL_URL="${1:-https://placeholder.vercel.app}"
PASS=0
FAIL=0

green() { echo -e "\033[32m  PASS\033[0m $1"; }
red()   { echo -e "\033[31m  FAIL\033[0m $1"; }
info()  { echo -e "\033[36m[TEST]\033[0m $1"; }

check() {
  local desc="$1"
  local method="$2"
  local url="$3"
  local expected_code="$4"
  local resp_code

  info "$desc"
  resp_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null)

  if [ "$resp_code" = "$expected_code" ]; then
    green "$url -> $resp_code"
    ((PASS++))
  else
    red "$url -> expected $expected_code, got $resp_code"
    ((FAIL++))
  fi
}

check_body() {
  local desc="$1"
  local url="$2"
  local pattern="$3"
  local body

  info "$desc"
  body=$(curl -s "$url" 2>/dev/null)

  if echo "$body" | grep -q "$pattern"; then
    green "$url -> found '$pattern'"
    ((PASS++))
  else
    red "$url -> '$pattern' NOT found in response"
    ((FAIL++))
  fi
}

echo ""
echo "========================================"
echo " AutoCurriculo AI - Smoke Tests"
echo " Target: $VERCEL_URL"
echo "========================================"
echo ""

# ---- FRONTEND PAGES ----
info "--- Frontend Pages ---"

check "Login page loads"        "GET" "$VERCEL_URL/login"                        200
check "Register page loads"     "GET" "$VERCEL_URL/register"                     200
check "Root redirects to login" "GET" "$VERCEL_URL/"                             307
check "Dashboard (unauthed)"    "GET" "$VERCEL_URL/dashboard"                    307
check_body "Login page content" "$VERCEL_URL/login"                              "AutoCurriculo"

# ---- STATIC ASSETS ----
info "--- Static Assets ---"

check "Favicon exists"          "GET" "$VERCEL_URL/favicon.ico"                  200
check "404 on random path"      "GET" "$VERCEL_URL/_this_does_not_exist_123"     404

# ---- API ROUTES ----
info "--- API Routes ---"

check "Webhook bot (no auth)"   "POST" "$VERCEL_URL/api/webhook/bot"             401
check "Webhook leads (no auth)" "POST" "$VERCEL_URL/api/webhook/leads"           401

# ---- SECURITY HEADERS ---
info "--- Security ---"

info "HTTPS redirect check"
RESP=$(curl -s -o /dev/null -w "%{url_effective}" -L "$VERCEL_URL/login" 2>/dev/null)
if echo "$RESP" | grep -q "^https"; then
  green "HTTPS enforced -> $RESP"
  ((PASS++))
else
  red "HTTPS not enforced -> $RESP"
  ((FAIL++))
fi

# ---- SUMMARY ---
echo ""
echo "========================================"
echo " Results: $PASS passed, $FAIL failed"
echo "========================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
