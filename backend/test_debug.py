
import requests

BASE_URL = "http://localhost:8000/api/receivables"

def test_debug():
    print(f"Testing GET {BASE_URL}/debug ...")
    try:
        r = requests.get(f"{BASE_URL}/debug")
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_debug()
