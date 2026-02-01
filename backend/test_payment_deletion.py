"""
Test script to verify payment deletion functionality
This will test deleting a payment and verifying that the amount is returned to the order
"""

import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_delete_payment():
    print("="*60)
    print("  TESTING PAYMENT DELETION")
    print("="*60)
    
    # Step 1: Get current payment history
    print("\n1. Getting current payment history...")
    try:
        # Note: This endpoint requires authentication
        # For testing, we'll try without auth first
        history_res = requests.get(f"{BASE_URL}/receivables/history")
        print(f"   Status: {history_res.status_code}")
        
        if history_res.status_code == 200:
            payments = history_res.json()
            print(f"   Total payments: {len(payments)}")
            
            if len(payments) > 0:
                # Show first payment
                payment = payments[0]
                print(f"\n   Payment to test:")
                print(f"   - ID: {payment['id']}")
                print(f"   - Client: {payment['cliente']}")
                print(f"   - Amount: ${payment['monto']:,.2f}")
                print(f"   - Date: {payment['fecha']}")
                
                # Step 2: Get the client's orders before deletion
                print(f"\n2. Getting client orders before deletion...")
                client_id = payment['cliente_id']
                orders_res = requests.get(f"{BASE_URL}/orders/")
                
                if orders_res.status_code == 200:
                    all_orders = orders_res.json()
                    client_orders = [o for o in all_orders if o['cliente_id'] == client_id]
                    
                    print(f"   Client {client_id} has {len(client_orders)} orders")
                    for order in client_orders:
                        print(f"   - Order {order['id']}: Total=${order['total']:,.2f}, "
                              f"Paid=${order.get('monto_pagado', 0):,.2f}, "
                              f"Status={order['estado']}")
                
                # Step 3: Ask user if they want to proceed
                print(f"\n3. Ready to delete payment {payment['id']}")
                print(f"   This will return ${payment['monto']:,.2f} to the client's orders")
                response = input("\n   Do you want to proceed? (yes/no): ")
                
                if response.lower() == 'yes':
                    print(f"\n4. Deleting payment {payment['id']}...")
                    delete_res = requests.delete(f"{BASE_URL}/receivables/payments/{payment['id']}")
                    
                    print(f"   Status: {delete_res.status_code}")
                    if delete_res.status_code == 200:
                        print(f"   Response: {delete_res.json()}")
                        
                        # Step 5: Verify the deletion
                        print(f"\n5. Verifying deletion...")
                        
                        # Check payment history again
                        history_res2 = requests.get(f"{BASE_URL}/receivables/history")
                        if history_res2.status_code == 200:
                            new_payments = history_res2.json()
                            print(f"   Payments after deletion: {len(new_payments)}")
                        
                        # Check client orders again
                        orders_res2 = requests.get(f"{BASE_URL}/orders/")
                        if orders_res2.status_code == 200:
                            all_orders2 = orders_res2.json()
                            client_orders2 = [o for o in all_orders2 if o['cliente_id'] == client_id]
                            
                            print(f"\n   Client {client_id} orders after deletion:")
                            for order in client_orders2:
                                print(f"   - Order {order['id']}: Total=${order['total']:,.2f}, "
                                      f"Paid=${order.get('monto_pagado', 0):,.2f}, "
                                      f"Status={order['estado']}")
                        
                        print("\n[OK] Payment deletion test completed successfully!")
                    else:
                        print(f"   [ERROR] Failed to delete payment: {delete_res.text}")
                else:
                    print("\n   Test cancelled by user")
            else:
                print("\n   No payments found to test deletion")
        else:
            print(f"   [ERROR] Failed to get payment history: {history_res.status_code}")
            print(f"   Response: {history_res.text}")
            
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        test_delete_payment()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
