
import urllib.request
import urllib.error

url = "http://localhost:8000/api/receivables/ping"

try:
    print(f"Checking {url}...")
    with urllib.request.urlopen(url) as response:
        print(f"Status: {response.status}")
        print(f"Body: {response.read().decode('utf-8')}")
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} {e.reason}")
except Exception as e:
    print(f"Error: {e}")
