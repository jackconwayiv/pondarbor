from django.test import SimpleTestCase

from config.allowed_hosts import build_allowed_hosts


class BuildAllowedHostsTests(SimpleTestCase):
    def test_appends_loopback_for_production_domains(self):
        hosts = build_allowed_hosts("pondarbor.com,www.pondarbor.com")
        self.assertEqual(
            hosts,
            ["pondarbor.com", "www.pondarbor.com", "127.0.0.1", "localhost"],
        )

    def test_default_includes_loopback_without_duplicates(self):
        hosts = build_allowed_hosts(None)
        self.assertEqual(hosts, ["127.0.0.1", "localhost"])

    def test_no_duplicate_loopback_when_already_present(self):
        hosts = build_allowed_hosts("pondarbor.com,127.0.0.1,localhost")
        self.assertEqual(
            hosts,
            ["pondarbor.com", "127.0.0.1", "localhost"],
        )

    def test_strips_whitespace_and_skips_empty_entries(self):
        hosts = build_allowed_hosts(" pondarbor.com , , www.pondarbor.com ")
        self.assertEqual(
            hosts,
            ["pondarbor.com", "www.pondarbor.com", "127.0.0.1", "localhost"],
        )
