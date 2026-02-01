"""
Test DELETE payment with authentication
This simulates what the frontend does when deleting a payment
"""

import requests
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api"

def get_auth_token():
    """Get authentication token by logging in"""
    print("1. Logging in to get auth token...")
    
    # Try to login (you'll need to provide valid credentials)
    login_data = {
        "username": "admin",  # Replace with actual username
        "password": "admin"   # Replace with actual password
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get('access_token')
            print(f"   ✓ Login successful! Token: {token[:20]}...")
            return token
        else:
            print(f"   ✗ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return None


def test_delete_payment_with_auth():
    print("="*60)
    print("  TESTING PAYMENT DELETION WITH AUTHENTICATION")
    print("="*60)
    
    # Get auth token
    token = get_auth_token()
    
    if not token:
        print("\n⚠ Cannot proceed without authentication token")
        print("Please update the credentials in this script or test from the frontend")
        return
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Get payment history
    print("\n2. Getting payment history...")
    try:
        response = requests.get(f"{BASE_URL}/receivables/history", headers=headers)
        if response.status_code == 200:
            payments = response.json()
            print(f"   ✓ Found {len(payments)} payments")
            
            if len(payments) > 0:
                payment = payments[0]
                print(f"\n   Payment to delete:")
                print(f"   - ID: {payment['id']}")
                print(f"   - Client: {payment['cliente']}")
                print(f"   - Amount: ${payment['monto']:,.2f}")
                
                # Ask for confirmation
                response_input = input("\n   Delete this payment? (yes/no): ")
                
                if response_input.lower() == 'yes':
                    print(f"\n3. Deleting payment {payment['id']}...")
                    delete_response = requests.delete(
                        f"{BASE_URL}/receivables/payments/{payment['id']}", 
                        headers=headers
                    )
                    
                    print(f"   Status: {delete_response.status_code}")
                    if delete_response.status_code == 200:
                        print(f"   ✓ Response: {delete_response.json()}")
                        print("\n   ✓ Payment deleted successfully!")
                        
                        # Verify deletion
                        print("\n4. Verifying deletion...")
                        verify_response = requests.get(f"{BASE_URL}/receivables/history", headers=headers)
                        if verify_response.status_code == 200:
                            new_payments = verify_response.json()
                            print(f"   ✓ Payments after deletion: {len(new_payments)}")
                    else:
                        print(f"   ✗ Error: {delete_response.text}")
                else:
                    print("\n   Deletion cancelled")
            else:
                print("   No payments to delete")
        else:
            print(f"   ✗ Error getting history: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ✗ Error: {e}")


if __name__ == "__main__":
    try:
        test_delete_payment_with_auth()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
