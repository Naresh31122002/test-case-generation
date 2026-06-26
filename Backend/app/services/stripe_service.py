import os
from datetime import datetime
from app.config import Config

# Mapping for credits
PLAN_LIMITS = {
    "free": 50,
    "starter": 500,
    "pro": 2000,
    "team": 10000,
    "enterprise": 50000
}

def get_plan_from_price_id(price_id: str) -> str:
    # Reverse lookup from ENV vars
    if price_id == os.getenv("STRIPE_PRICE_STARTER"): return "starter"
    if price_id == os.getenv("STRIPE_PRICE_PRO"): return "pro"
    if price_id == os.getenv("STRIPE_PRICE_TEAM"): return "team"
    if price_id == os.getenv("STRIPE_PRICE_ENTERPRISE"): return "enterprise"
    return "free"

def handle_stripe_event(event: dict):
    event_type = event['type']
    data = event['data']['object']

    if event_type in ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']:
        _handle_subscription_change(data)
    elif event_type == 'invoice.payment_succeeded':
        _handle_invoice_succeeded(data)
    elif event_type == 'invoice.payment_failed':
        _handle_invoice_failed(data)

def _handle_subscription_change(subscription: dict):
    # The client_reference_id is only on checkout session.
    # To find the workspace, we map via metadata on the subscription if we added it,
    # or by stripe_customer_id if it's an existing customer.
    # In checkout session, we added metadata: {"workspace_id": ws_id} to the subscription? No, we added it to the checkout session.
    # Wait, stripe automatically copies metadata from checkout session to subscription IF configured, or we can just lookup by customer_id.
    
    customer_id = subscription.get('customer')
    sub_id = subscription.get('id')
    status = subscription.get('status')
    current_period_end = subscription.get('current_period_end')
    
    items = subscription.get('items', {}).get('data', [])
    if not items:
        return
        
    price_id = items[0].get('price', {}).get('id')
    plan = get_plan_from_price_id(price_id)
    
    # Check if subscription was canceled or unpaid
    if status in ['canceled', 'unpaid', 'past_due']:
        if status == 'canceled':
            plan = 'free'
    
    import psycopg2
    from app.config import Config
    
    with psycopg2.connect(
        dbname=Config.POSTGRES_DB,
        user=Config.POSTGRES_USER,
        password=Config.POSTGRES_PASSWORD,
        host=Config.POSTGRES_HOST,
        port=Config.POSTGRES_PORT
    ) as conn:
        with conn.cursor() as cur:
            # First find the workspace_id based on stripe_customer_id
            cur.execute("SELECT id, plan FROM workspaces WHERE stripe_customer_id = %s", (customer_id,))
            row = cur.fetchone()
            
            if not row:
                # If no customer matches, it might be a new subscription from checkout session.
                # Let's see if metadata has it.
                ws_id = subscription.get('metadata', {}).get('workspace_id')
                if not ws_id:
                    print(f"Could not find workspace for customer {customer_id}")
                    return
                # Update workspace with customer id
                cur.execute(
                    "UPDATE workspaces SET stripe_customer_id = %s WHERE id = %s RETURNING id",
                    (customer_id, ws_id)
                )
                if not cur.fetchone():
                    return
            else:
                ws_id = row[0]
                old_plan = row[1]
            
            # Update workspace subscription details
            cur.execute("""
                UPDATE workspaces 
                SET stripe_subscription_id = %s,
                    stripe_price_id = %s,
                    subscription_status = %s,
                    subscription_current_period_end = to_timestamp(%s),
                    plan = %s
                WHERE id = %s
            """, (sub_id, price_id, status, current_period_end, plan, ws_id))
            
            # Sync plan changes to workspace_credits
            new_limit = PLAN_LIMITS.get(plan, 50)
            
            cur.execute("""
                INSERT INTO workspace_credits (workspace_id, monthly_limit, credits_used)
                VALUES (%s, %s, 0)
                ON CONFLICT (workspace_id)
                DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
            """, (ws_id, new_limit))

def _handle_invoice_succeeded(invoice: dict):
    # Could be used to extend subscription explicitly or record payments
    customer_id = invoice.get('customer')
    amount_paid = invoice.get('amount_paid', 0) / 100.0
    
    if amount_paid <= 0:
        return
        
    lines = invoice.get('lines', {}).get('data', [])
    if not lines:
        return
        
    price_id = lines[0].get('price', {}).get('id')
    plan = get_plan_from_price_id(price_id)
    
    import psycopg2
    from app.config import Config
    with psycopg2.connect(**Config.postgres_config()) as conn:
        with conn.cursor() as cur:
            # Get owner email
            cur.execute("""
                SELECT u.email, u.full_name
                FROM workspaces w
                JOIN users u ON w.owner_id = u.user_id
                WHERE w.stripe_customer_id = %s
            """, (customer_id,))
            row = cur.fetchone()
            if row:
                email, name = row
                try:
                    from app.tasks.email_tasks import task_send_subscription_renewed
                    task_send_subscription_renewed.delay(email, name or "Customer", plan, f"${amount_paid:.2f}")
                except Exception as celery_err:
                    import logging
                    logging.getLogger(__name__).warning("[stripe] Celery unavailable, skipping renewal email: %s", celery_err)

def _handle_invoice_failed(invoice: dict):
    customer_id = invoice.get('customer')
    import psycopg2
    from app.config import Config
    with psycopg2.connect(**Config.postgres_config()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.email, u.full_name
                FROM workspaces w
                JOIN users u ON w.owner_id = u.user_id
                WHERE w.stripe_customer_id = %s
            """, (customer_id,))
            row = cur.fetchone()
            if row:
                email, name = row
                try:
                    from app.tasks.email_tasks import task_send_payment_failed
                    task_send_payment_failed.delay(email, name or "Customer")
                except Exception as celery_err:
                    import logging
                    logging.getLogger(__name__).warning("[stripe] Celery unavailable, skipping failed payment email: %s", celery_err)
