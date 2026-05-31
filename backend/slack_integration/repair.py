"""Idempotent schema repair helpers for slack_integration."""


def ensure_slackeventreceipt_table(apps, schema_editor):
    """
    Production may have slack_integration.0001 marked applied without this table
    (schema drift). Create it when missing so ingest dedupe and admin work.
    """
    table = "slack_integration_slackeventreceipt"
    existing = set(schema_editor.connection.introspection.table_names())
    if table in existing:
        return
    model = apps.get_model("slack_integration", "SlackEventReceipt")
    schema_editor.create_model(model)
