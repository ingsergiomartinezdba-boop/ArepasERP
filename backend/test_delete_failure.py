"""
Test to verify the DELETE endpoint is accessible
"""

import requests

BASE_URL = "http://localhost:8000/api/receivables"

def test_endpoints():
    print("Testing Receivables Endpoints...")
    print("="*60)
    
    # Test 1: Ping endpoint (no auth required)
    print("\n1. Testing GET /ping")
    try:
        r = requests.get(f"{BASE_URL}/ping")
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Get payment by ID (no auth required based on code)
    print("\n2. Testing GET /payments/1")
    try:
        r = requests.get(f"{BASE_URL}/payments/1")
        print(f"   Status: {r.status_code}")
        if r.status_code == 200:
            print(f"   Response: {r.json()}")
        else:
            print(f"   Response: {r.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Try DELETE without auth (should fail with 401 or 403)
    print("\n3. Testing DELETE /payments/1 (without auth)")
    try:
        r = requests.delete(f"{BASE_URL}/payments/1")
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 4: Check if the route exists with OPTIONS
    print("\n4. Testing OPTIONS /payments/1")
    try:
        r = requests.options(f"{BASE_URL}/payments/1")
        print(f"   Status: {r.status_code}")
        print(f"   Headers: {dict(r.headers)}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    test_endpoints()
