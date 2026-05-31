from django.apps import apps
from django.db import connection
from django.test import TransactionTestCase

from slack_integration.models import SlackEventReceipt
from slack_integration.repair import ensure_slackeventreceipt_table


class EnsureSlackEventReceiptTableTests(TransactionTestCase):
    def test_creates_table_when_missing(self):
        table = "slack_integration_slackeventreceipt"
        with connection.schema_editor() as editor:
            editor.execute(f"DROP TABLE IF EXISTS {editor.quote_name(table)}")

        with connection.schema_editor() as editor:
            ensure_slackeventreceipt_table(apps, editor)

        SlackEventReceipt.objects.create(event_id="migration-smoke")
        self.assertTrue(SlackEventReceipt.objects.filter(event_id="migration-smoke").exists())

    def test_noop_when_table_exists(self):
        SlackEventReceipt.objects.create(event_id="already-there")
        with connection.schema_editor() as editor:
            ensure_slackeventreceipt_table(apps, editor)
        self.assertEqual(SlackEventReceipt.objects.filter(event_id="already-there").count(), 1)
