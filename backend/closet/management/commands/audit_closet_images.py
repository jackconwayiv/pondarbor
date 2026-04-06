import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from closet.models import Item


class Command(BaseCommand):
    help = "Audit closet image usage vs R2 objects under the configured prefix."

    def add_arguments(self, parser):
        parser.add_argument("--delete-orphans", action="store_true", default=False)
        parser.add_argument("--prefix", default=os.getenv("CLOSET_R2_KEY_PREFIX", "closet"))

    def handle(self, *args, **options):
        account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
        endpoint_override = getattr(settings, "CLOSET_R2_S3_ENDPOINT_URL", "") or ""
        bucket = os.getenv("CLOSET_R2_BUCKET", "")
        access_key = os.getenv("CLOSET_R2_ACCESS_KEY_ID", "")
        secret_key = os.getenv("CLOSET_R2_SECRET_ACCESS_KEY", "")
        if not bucket or not access_key or not secret_key:
            raise CommandError("R2 env vars are not fully configured.")
        if not endpoint_override and not account_id:
            raise CommandError(
                "Set CLOUDFLARE_ACCOUNT_ID or CLOSET_R2_S3_ENDPOINT_URL for the S3 API endpoint.",
            )
        try:
            import boto3
        except Exception as exc:
            raise CommandError("boto3 is required for closet image audit.") from exc

        prefix = options["prefix"]
        db_keys = set(
            Item.objects.exclude(image_key="")
            .exclude(deleted_at__isnull=False)
            .values_list("image_key", flat=True)
        )
        if endpoint_override:
            endpoint_url = (
                endpoint_override if "://" in endpoint_override else f"https://{endpoint_override}"
            )
        else:
            endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )

        bucket_keys = set()
        total_bytes = 0
        token = None
        while True:
            params = {"Bucket": bucket, "Prefix": prefix}
            if token:
                params["ContinuationToken"] = token
            payload = client.list_objects_v2(**params)
            for obj in payload.get("Contents", []):
                key = obj["Key"]
                bucket_keys.add(key)
                total_bytes += int(obj.get("Size", 0))
            if not payload.get("IsTruncated"):
                break
            token = payload.get("NextContinuationToken")

        orphans = sorted(bucket_keys - db_keys)
        missing = sorted(db_keys - bucket_keys)

        self.stdout.write(f"Referenced in DB: {len(db_keys)}")
        self.stdout.write(f"Present in bucket: {len(bucket_keys)}")
        self.stdout.write(f"Orphan objects: {len(orphans)}")
        self.stdout.write(f"Missing objects: {len(missing)}")
        self.stdout.write(f"Total bytes under prefix: {total_bytes}")

        if options["delete_orphans"] and orphans:
            for key in orphans:
                client.delete_object(Bucket=bucket, Key=key)
            self.stdout.write(self.style.SUCCESS(f"Deleted {len(orphans)} orphan objects."))
        elif orphans:
            self.stdout.write("Run with --delete-orphans to remove orphan objects.")

