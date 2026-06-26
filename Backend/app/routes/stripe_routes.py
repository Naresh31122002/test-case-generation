import os
import stripe
from flask import Blueprint, request, jsonify, redirect
from app.utils.workspace import workspace_required, get_current_workspace_id
from app.models.workspace_model import WorkspaceModel

stripe_bp = Blueprint('stripe', __name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Price IDs must be set via env vars — no mock fallbacks (they cause Stripe API errors).
# If a price is not configured the plan is simply unavailable.
PLAN_TO_PRICE = {
    plan: os.getenv(env)
    for plan, env in [
        ("starter",    "STRIPE_PRICE_STARTER"),
        ("pro",        "STRIPE_PRICE_PRO"),
        ("team",       "STRIPE_PRICE_TEAM"),
        ("enterprise", "STRIPE_PRICE_ENTERPRISE"),
    ]
    if os.getenv(env)
}


def _stripe_configured() -> bool:
    """Return True only when a real Stripe secret key is present."""
    key = os.getenv("STRIPE_SECRET_KEY", "")
    # Stripe test keys start with sk_test_, live keys with sk_live_
    return bool(key and key.startswith("sk_"))

@stripe_bp.route("/checkout", methods=["POST"])
@workspace_required
def create_checkout_session():
    if not _stripe_configured():
        return jsonify({'error': 'Billing is not configured on this server'}), 503
    ws_id = get_current_workspace_id()
    data = request.get_json()
    
    if not data or 'plan' not in data:
        return jsonify({'error': 'Missing plan parameter'}), 400
        
    plan = data['plan'].lower()
    
    if plan not in PLAN_TO_PRICE:
        return jsonify({'error': 'Invalid plan selected'}), 400
        
    price_id = PLAN_TO_PRICE[plan]
    
    # Get workspace to check if they already have a customer ID
    ws = WorkspaceModel.get_by_id(ws_id)
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404
        
    customer_id = ws.get('stripe_customer_id')
    
    success_url = request.headers.get("Origin", "http://localhost:3000") + "/settings/billing?success=true"
    cancel_url = request.headers.get("Origin", "http://localhost:3000") + "/settings/billing?canceled=true"

    try:
        checkout_params = {
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": ws_id,
            "metadata": {"workspace_id": ws_id, "plan": plan},
            "subscription_data": {
                "metadata": {"workspace_id": ws_id}
            }
        }
        
        if customer_id:
            checkout_params["customer"] = customer_id
            
        session = stripe.checkout.Session.create(**checkout_params)
        
        return jsonify({'url': session.url}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stripe_bp.route("/portal", methods=["POST"])
@workspace_required
def create_portal_session():
    if not _stripe_configured():
        return jsonify({'error': 'Billing is not configured on this server'}), 503
    ws_id = get_current_workspace_id()
    ws = WorkspaceModel.get_by_id(ws_id)
    
    if not ws:
        return jsonify({'error': 'Workspace not found'}), 404
        
    customer_id = ws.get('stripe_customer_id')
    
    if not customer_id:
        return jsonify({'error': 'No billing history found. Please subscribe to a plan first.'}), 400
        
    return_url = request.headers.get("Origin", "http://localhost:3000") + "/settings/billing"
    
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return jsonify({'url': portal_session.url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stripe_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    if not webhook_secret:
        # Return 200 so Stripe does not retry indefinitely when billing is intentionally disabled
        return jsonify({'status': 'billing not configured'}), 200

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': 'Invalid signature'}), 400

    # Handle the event
    from app.services.stripe_service import handle_stripe_event
    try:
        handle_stripe_event(event)
    except Exception as e:
        print(f"Error handling webhook event {event['type']}: {str(e)}")
        return jsonify({'error': 'Webhook handler failed'}), 500

    return jsonify({'status': 'success'}), 200
