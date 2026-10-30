"""
Runnable Sample App: Event Tracker in Python
Demonstrates real-time user action streaming into Relay CDP and reading unified profile traits.
"""

import os
import time
import requests

RELAY_API_KEY = os.getenv("RELAY_API_KEY", "rl_test_demo_acmepay_key_01")
BASE_URL = os.getenv("RELAY_BASE_URL", "http://localhost:3001/api/v1")

def track_event(external_id: str, event_name: str, properties: dict):
    print(f"\n⚡ Ingesting CDP Event '{event_name}' for customer '{external_id}'...")

    url = f"{BASE_URL}/events"
    headers = {
        "Authorization": f"Bearer {RELAY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "external_id": external_id,
        "event": event_name,
        "properties": properties,
        "timestamp": int(time.time()),
    }

    res = requests.post(url, headers=headers, json=payload)
    if not res.ok:
        print(f"❌ Ingestion failed: {res.text}")
        return

    data = res.json()
    print(f"✅ Event accepted by CDP Engine! (Total: {data.get('total')}, Accepted: {data.get('accepted')})")

def fetch_profile(external_id: str):
    print(f"\n🔍 Querying unified customer profile for 'ext_{external_id}'...")
    url = f"{BASE_URL}/customers/ext_{external_id}"
    headers = {"Authorization": f"Bearer {RELAY_API_KEY}"}

    res = requests.get(url, headers=headers)
    if not res.ok:
        print(f"❌ Failed to fetch profile: {res.text}")
        return

    profile = res.json()
    print("👤 Unified Customer Profile:")
    print(f"   - Internal Relay ID: {profile.get('id')}")
    print(f"   - Name: {profile.get('attributes', {}).get('name')}")
    print(f"   - Preferred Channel: {profile.get('traits', {}).get('preferred_channel')}")
    print(f"   - Aggregated Events Count: {profile.get('traits', {}).get('total_events')}")
    print(f"   - WhatsApp Consent: {profile.get('consent', {}).get('whatsapp_opt_in')}")

if __name__ == "__main__":
    test_user_id = "cust_acmepay_7710"
    
    # 1. Track an order event
    track_event(
        external_id=test_user_id,
        event_name="checkout_completed",
        properties={"amount_inr": 3499, "payment_method": "upi", "category": "electronics"}
    )

    # 2. Query the updated profile
    fetch_profile(test_user_id)
