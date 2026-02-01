
import requests
import json

BASE_URL = "http://localhost:8000/api/receivables"

def test_get_history():
    print(f"Testing GET {BASE_URL}/history ...")
    try:
        r = requests.get(f"{BASE_URL}/history")
        print(f"Status: {r.status_code}")
        # print(r.json())
    except Exception as e:
        print(f"Error: {e}")

def test_get_payment(id):
    print(f"Testing GET {BASE_URL}/payments/{id} ...")
    try:
        r = requests.get(f"{BASE_URL}/payments/{id}")
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_delete_check(id):
    print(f"Testing DELETE {BASE_URL}/payments/{id} (Dry Run check)...")
    # We won't actually delete, just check if route exists by seeing if we get 401 (if auth) or 404 or 500
    # Ideally we'd get 401 because we aren't sending token.
    # If we get 404 "Not Found" (generic), it means route doesn't exist.
    # If we get 401, route exists.
    try:
        r = requests.delete(f"{BASE_URL}/payments/{id}")
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_get_history()
    test_get_payment(1)
    test_delete_check(1)
