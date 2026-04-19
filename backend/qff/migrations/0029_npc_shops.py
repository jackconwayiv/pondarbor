import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("qff", "0028_qffineffectiveinput_room"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="unsellable",
            field=models.BooleanField(
                default=False,
                help_text="If true, players cannot sell this template to vendors.",
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="vendor_refuses_buy",
            field=models.BooleanField(
                default=False,
                help_text="If true, vendors treat this as junk and will not buy it from players.",
            ),
        ),
        migrations.AddField(
            model_name="iteminstance",
            name="is_crafted",
            field=models.BooleanField(
                default=False,
                help_text="If true, shop consignment decay does not apply to this instance.",
            ),
        ),
        migrations.CreateModel(
            name="NpcShop",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("welcome_text", models.TextField(blank=True, help_text="Shown when players list the shop (shop / list / buy with no args).")),
                ("enabled", models.BooleanField(default=True)),
                (
                    "sell_price_percent",
                    models.PositiveSmallIntegerField(
                        default=50,
                        help_text="Percent of Item.cost offered when a player sells (e.g. 50 = half).",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "npc",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shop",
                        to="qff.npc",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="NpcShopStockLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("price", models.PositiveIntegerField(help_text="Gold per purchase (per unit for stackable).")),
                (
                    "quantity",
                    models.PositiveIntegerField(
                        blank=True,
                        help_text="Stock remaining; null = unlimited (static only).",
                        null=True,
                    ),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "kind",
                    models.CharField(
                        choices=[("static", "Static"), ("consignment", "Consignment")],
                        default="static",
                        max_length=16,
                    ),
                ),
                (
                    "times_shown_without_sale",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="Consignment: increments when listed and not bought; removed at 5 (unless crafted).",
                    ),
                ),
                (
                    "consignment_item_instance",
                    models.OneToOneField(
                        blank=True,
                        help_text="If set, this row sells that exact instance (consignment).",
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shop_consignment_line",
                        to="qff.iteminstance",
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shop_stock_lines",
                        to="qff.item",
                    ),
                ),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stock_lines",
                        to="qff.npcshop",
                    ),
                ),
            ],
            options={
                "ordering": ["shop_id", "sort_order", "id"],
            },
        ),
    ]
