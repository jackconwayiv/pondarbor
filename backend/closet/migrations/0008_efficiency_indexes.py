from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("closet", "0007_item_hidden_per_user"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="item",
            index=models.Index(fields=["owner_user", "-updated_at"], name="closet_item_owner_upd_idx"),
        ),
        migrations.AddIndex(
            model_name="item",
            index=models.Index(fields=["owner_user", "-created_at"], name="closet_item_owner_crt_idx"),
        ),
        migrations.AddIndex(
            model_name="item",
            index=models.Index(fields=["current_holder_user", "-updated_at"], name="closet_item_holder_upd_idx"),
        ),
        migrations.AddIndex(
            model_name="item",
            index=models.Index(
                fields=["custody_pending_acceptance_user", "-updated_at"],
                name="closet_item_pending_upd_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="borrowrequest",
            index=models.Index(fields=["item", "status", "deleted_at"], name="closet_req_item_status_del_idx"),
        ),
        migrations.AddIndex(
            model_name="borrowrequest",
            index=models.Index(
                fields=["requester_user", "status", "deleted_at"],
                name="closet_req_requester_status_del_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="loan",
            index=models.Index(fields=["item", "status", "deleted_at"], name="closet_loan_item_status_del_idx"),
        ),
        migrations.AddIndex(
            model_name="loan",
            index=models.Index(
                fields=["owner_user", "status", "deleted_at"],
                name="closet_loan_owner_status_del_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="loan",
            index=models.Index(
                fields=["borrower_user", "status", "deleted_at"],
                name="closet_loan_borrower_status_del_idx",
            ),
        ),
    ]
