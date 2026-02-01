"""
Payment Verification Script
Checks payment allocation logic, FIFO ordering, and pagos_pedidos traceability
"""

import sys
import os
from datetime import datetime
from typing import List, Dict, Any

# Ensure we can import from backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database import supabase
    print("[OK] Successfully connected to Supabase")
except ImportError as e:
    print(f"[ERROR] Error importing database: {e}")
    print("Make sure you're running this from the backend directory")
    sys.exit(1)


def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def check_payments():
    """Check all payments in the system"""
    print_section("PAYMENTS (pagos_recibidos)")
    
    try:
        res = supabase.table("pagos_recibidos").select("*").order("fecha", desc=True).execute()
        
        if not res.data:
            print("No payments found in the database")
            return []
        
        print(f"Total Payments: {len(res.data)}\n")
        
        for p in res.data:
            print(f"ID: {p['id']:3d} | Client: {p['cliente_id']:3d} | "
                  f"Amount: ${p['monto']:>10,.2f} | "
                  f"Date: {p['fecha'][:10]} | "
                  f"Method: {p.get('metodo_pago_id', 'N/A')}")
            if p.get('descripcion'):
                print(f"         Description: {p['descripcion']}")
        
        return res.data
    except Exception as e:
        print(f"[ERROR] Error querying payments: {e}")
        return []


def check_payment_order_links():
    """Check the pagos_pedidos traceability table"""
    print_section("PAYMENT-ORDER LINKS (pagos_pedidos)")
    
    try:
        res = supabase.table("pagos_pedidos").select("*").order("pago_id").execute()
        
        if not res.data:
            print("No payment-order links found")
            print("Note: This table tracks which payment covered which order")
            return []
        
        print(f"Total Links: {len(res.data)}\n")
        
        current_payment = None
        for link in res.data:
            if current_payment != link['pago_id']:
                current_payment = link['pago_id']
                print(f"\nPayment ID {link['pago_id']}:")
            
            print(f"  → Order {link['pedido_id']:3d}: ${link['monto_aplicado']:>10,.2f}")
        
        return res.data
    except Exception as e:
        print(f"[ERROR] Error querying payment-order links: {e}")
        return []


def check_orders_with_payments(client_id: int = None):
    """Check orders and their payment status"""
    print_section("ORDERS WITH PAYMENTS")
    
    try:
        query = supabase.table("pedidos").select("*")
        
        if client_id:
            query = query.eq("cliente_id", client_id)
        
        res = query.order("fecha").execute()
        
        if not res.data:
            print("No orders found")
            return []
        
        print(f"Total Orders: {len(res.data)}\n")
        
        for order in res.data:
            total = float(order.get('total', 0))
            paid = float(order.get('monto_pagado', 0))
            pending = total - paid
            
            status_icon = "[PAID]" if order['estado'] == 'pagado' else "[PEND]"
            
            print(f"{status_icon} Order {order['id']:3d} | Client: {order['cliente_id']:3d} | "
                  f"Date: {order['fecha'][:10]}")
            print(f"  Total: ${total:>10,.2f} | Paid: ${paid:>10,.2f} | "
                  f"Pending: ${pending:>10,.2f} | Status: {order['estado']}")
        
        return res.data
    except Exception as e:
        print(f"[ERROR] Error querying orders: {e}")
        return []


def verify_fifo_allocation(client_id: int):
    """Verify that payments are allocated in FIFO order for a specific client"""
    print_section(f"FIFO VERIFICATION FOR CLIENT {client_id}")
    
    try:
        # Get all orders for this client
        orders_res = supabase.table("pedidos").select("*").eq("cliente_id", client_id).order("fecha").execute()
        orders = orders_res.data
        
        if not orders:
            print(f"No orders found for client {client_id}")
            return
        
        print(f"Orders (oldest first):")
        for i, order in enumerate(orders, 1):
            total = float(order.get('total', 0))
            paid = float(order.get('monto_pagado', 0))
            pending = total - paid
            
            print(f"{i}. Order {order['id']} - Date: {order['fecha'][:10]} - "
                  f"Total: ${total:,.2f} - Paid: ${paid:,.2f} - Pending: ${pending:,.2f}")
        
        # Check if FIFO is respected
        print("\nFIFO Check:")
        fifo_respected = True
        
        for i in range(len(orders) - 1):
            current_order = orders[i]
            next_order = orders[i + 1]
            
            current_total = float(current_order.get('total', 0))
            current_paid = float(current_order.get('monto_pagado', 0))
            next_paid = float(next_order.get('monto_pagado', 0))
            
            # If next order has payment but current is not fully paid, FIFO is violated
            if next_paid > 0 and current_paid < current_total:
                print(f"[ERROR] FIFO VIOLATION: Order {next_order['id']} has payment "
                      f"but Order {current_order['id']} is not fully paid")
                fifo_respected = False
        
        if fifo_respected:
            print("[OK] FIFO allocation is correct!")
        
    except Exception as e:
        print(f"[ERROR] Error verifying FIFO: {e}")


def check_client_balance(client_id: int):
    """Check the balance for a specific client"""
    print_section(f"CLIENT {client_id} BALANCE")
    
    try:
        # Get total from orders
        orders_res = supabase.table("pedidos").select("total, monto_pagado").eq("cliente_id", client_id).execute()
        
        total_orders = sum(float(o.get('total', 0)) for o in orders_res.data)
        total_paid_via_orders = sum(float(o.get('monto_pagado', 0)) for o in orders_res.data)
        
        # Get total from payments
        payments_res = supabase.table("pagos_recibidos").select("monto").eq("cliente_id", client_id).execute()
        total_payments = sum(float(p.get('monto', 0)) for p in payments_res.data)
        
        print(f"Total Orders Amount:     ${total_orders:>12,.2f}")
        print(f"Total Payments Received: ${total_payments:>12,.2f}")
        print(f"Total Applied to Orders: ${total_paid_via_orders:>12,.2f}")
        print(f"Pending Balance:         ${(total_orders - total_paid_via_orders):>12,.2f}")
        
        # Check for discrepancies
        if abs(total_payments - total_paid_via_orders) > 0.01:
            print(f"\n[WARNING] Payment total (${total_payments:,.2f}) doesn't match "
                  f"applied amount (${total_paid_via_orders:,.2f})")
            print(f"   Difference: ${abs(total_payments - total_paid_via_orders):,.2f}")
        else:
            print("\n[OK] Payment totals match!")
        
    except Exception as e:
        print(f"[ERROR] Error checking client balance: {e}")


def main():
    """Main function to run all checks"""
    print("\n" + "="*60)
    print("  PAYMENT SYSTEM VERIFICATION")
    print("="*60)
    
    # Check all payments
    payments = check_payments()
    
    # Check payment-order links
    links = check_payment_order_links()
    
    # Check orders
    orders = check_orders_with_payments()
    
    # If we have data, do additional checks
    if orders:
        # Get unique client IDs
        client_ids = list(set(o['cliente_id'] for o in orders))
        
        for client_id in client_ids:
            verify_fifo_allocation(client_id)
            check_client_balance(client_id)
    
    print_section("VERIFICATION COMPLETE")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nVerification interrupted by user")
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
