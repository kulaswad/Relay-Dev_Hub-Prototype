import hmac
import hashlib
import time
import re
import requests
from typing import Optional, Dict, Any

class RelayClient:
    """Official Python Client for Relay Telecom & Customer Data Platform (CDP) APIs."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3001/api/v1",
        api_version: str = "2025-10-01"
    ):
        if not api_key:
            raise ValueError("RelayClient requires a valid API key (rl_test_... or rl_live_...)")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.api_version = api_version

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        req_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Relay-Version": self.api_version,
            "User-Agent": "Relay-Python-SDK/1.0"
        }
        if headers:
            req_headers.update(headers)

        response = requests.request(
            method=method,
            url=url,
            json=data if data else None,
            params=params,
            headers=req_headers
        )

        try:
            res_json = response.json()
        except Exception:
            response.raise_for_status()
            return {}

        if not response.ok:
            err = res_json.get("error", {})
            msg = err.get("message", f"HTTP {response.status_code}")
            code = err.get("code", "unknown_error")
            raise RuntimeError(f"Relay API Error [{code}]: {msg}")

        return res_json

    # --- Messages API ---
    def send_message(
        self,
        to: str,
        channel: str,
        template_id: str,
        variables: Optional[Dict[str, str]] = None,
        sender_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        headers = {}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        payload = {
            "to": to,
            "channel": channel,
            "template_id": template_id,
            "variables": variables or {},
            "sender_id": sender_id,
            "metadata": metadata
        }
        return self._request("POST", "/messages", data=payload, headers=headers)

    def get_message(self, message_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/messages/{message_id}")

    def list_messages(self, limit: int = 20, starting_after: Optional[str] = None, status: Optional[str] = None) -> Dict[str, Any]:
        params = {"limit": limit}
        if starting_after:
            params["starting_after"] = starting_after
        if status:
            params["status"] = status
        return self._request("GET", "/messages", params=params)

    # --- CDP Events & Profiles ---
    def ingest_event(
        self,
        event: str,
        external_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        timestamp: Optional[int] = None
    ) -> Dict[str, Any]:
        payload = {
            "event": event,
            "external_id": external_id,
            "customer_id": customer_id,
            "properties": properties or {},
            "timestamp": timestamp
        }
        return self._request("POST", "/events", data=payload)

    def get_customer(self, customer_id_or_ext: str) -> Dict[str, Any]:
        return self._request("GET", f"/customers/{customer_id_or_ext}")

    def update_customer(self, customer_id_or_ext: str, traits: Optional[Dict[str, Any]] = None, attributes: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        payload = {
            "traits": traits or {},
            "attributes": attributes or {}
        }
        return self._request("PUT", f"/customers/{customer_id_or_ext}", data=payload)

    # --- Webhook Cryptographic Verification ---
    @staticmethod
    def verify_webhook_signature(
        raw_body_bytes: bytes,
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300
    ) -> bool:
        t_match = re.search(r't=(\d+)', signature_header)
        if not t_match:
            return False
        timestamp = t_match.group(1)

        # Clock drift replay protection
        if abs(time.time() - int(timestamp)) > tolerance_seconds:
            return False

        signed_payload = f"{timestamp}.".encode("utf-8") + raw_body_bytes
        computed = hmac.new(
            secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256
        ).hexdigest()

        v1_hashes = re.findall(r'v1=([a-f0-9]{64})', signature_header)
        for v1 in v1_hashes:
            if hmac.compare_digest(v1, computed):
                return True
        return False
