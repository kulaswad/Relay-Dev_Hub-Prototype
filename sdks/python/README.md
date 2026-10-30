# relay-python — Official Python SDK

Official Python library for Relay Telecom & Customer Data Platform (CDP) APIs.

## Installation

```bash
pip install relay-sdk
```

## Quick Start

```python
from relay import RelayClient

relay = RelayClient(api_key="rl_test_demo_acmepay_key_01")

# 1. Send SMS OTP Message
msg = relay.send_message(
    to="+919999900001",
    channel="sms",
    template_id="dlt_tmpl_otp_login",
    variables={"1": "481029"},
    sender_id="RELAYI"
)
print("Message Queued ID:", msg["id"])

# 2. Ingest CDP Events
relay.ingest_event(
    event="checkout_completed",
    external_id="cust_acme_7710",
    properties={"amount": 2999, "currency": "INR"}
)

# 3. Retrieve Unified Customer Profile
profile = relay.get_customer("ext_cust_acme_7710")
print("Preferred Channel:", profile["traits"]["preferred_channel"])

# 4. Verify Webhooks in FastAPI / Flask
is_valid = RelayClient.verify_webhook_signature(
    raw_body_bytes=raw_bytes,
    signature_header=request.headers.get("relay-signature"),
    secret="whsec_test_..."
)
```
