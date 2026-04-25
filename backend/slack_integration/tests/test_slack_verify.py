import hashlib
import hmac
from unittest import mock

from django.test import TestCase
from django.test.utils import override_settings

from slack_integration.slack_verify import verify_slack_request_signature


def _slack_sig(*, secret: str, timestamp: str, body: bytes) -> str:
    basestring = b"v0:" + timestamp.encode("utf-8") + b":" + body
    digest = hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return f"v0:{digest}"


class SlackSignatureVerifyTests(TestCase):
    @override_settings(SLACK_SIGNING_SECRET="test_secret")
    def test_valid_signature_verifies(self):
        body = b"token=legacy&team_id=T123&command=%2Fsong&text=https%3A%2F%2Fyoutu.be%2Fabc123"
        timestamp = "1714060800"
        sig = _slack_sig(secret="test_secret", timestamp=timestamp, body=body)
        with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp)):
            self.assertTrue(
                verify_slack_request_signature(
                    body=body,
                    timestamp=timestamp,
                    signature=sig,
                )
            )

    @override_settings(SLACK_SIGNING_SECRET="test_secret")
    def test_invalid_signature_rejected(self):
        body = b"command=%2Fsong&text=hi"
        timestamp = "1714060800"
        with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp)):
            self.assertFalse(
                verify_slack_request_signature(
                    body=body,
                    timestamp=timestamp,
                    signature="v0:deadbeef",
                )
            )

    @override_settings(SLACK_SIGNING_SECRET="test_secret")
    def test_old_timestamp_rejected(self):
        body = b"command=%2Fsong&text=hi"
        timestamp = "1714060800"
        sig = _slack_sig(secret="test_secret", timestamp=timestamp, body=body)
        with mock.patch("slack_integration.slack_verify.time.time", return_value=int(timestamp) + 60 * 6):
            self.assertFalse(
                verify_slack_request_signature(
                    body=body,
                    timestamp=timestamp,
                    signature=sig,
                )
            )

