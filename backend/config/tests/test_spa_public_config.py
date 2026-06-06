from unittest import mock

from django.test import TestCase
from django.test.utils import override_settings

from config.spa_public_config import get_spa_public_config


class SpaPublicConfigSentryTests(TestCase):
    @override_settings(DEBUG=True)
    def test_omits_sentry_when_debug_true(self):
        env = {
            "SENTRY_DSN": "https://example@o0.ingest.sentry.io/0",
            "SENTRY_ENVIRONMENT": "staging",
            "SENTRY_TRACES_SAMPLE_RATE": "0.1",
        }
        with mock.patch.dict("os.environ", env, clear=False):
            config = get_spa_public_config()

        self.assertNotIn("sentryDsn", config)
        self.assertNotIn("sentryEnvironment", config)
        self.assertNotIn("sentryTracesSampleRate", config)

    @override_settings(DEBUG=False)
    def test_includes_sentry_when_debug_false_and_dsn_set(self):
        env = {
            "SENTRY_DSN": "https://example@o0.ingest.sentry.io/0",
            "SENTRY_ENVIRONMENT": "staging",
            "SENTRY_TRACES_SAMPLE_RATE": "0.1",
        }
        with mock.patch.dict("os.environ", env, clear=False):
            config = get_spa_public_config()

        self.assertEqual(config["sentryDsn"], env["SENTRY_DSN"])
        self.assertEqual(config["sentryEnvironment"], "staging")
        self.assertEqual(config["sentryTracesSampleRate"], "0.1")

    @override_settings(DEBUG=False)
    def test_omits_sentry_when_dsn_unset(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            config = get_spa_public_config()

        self.assertNotIn("sentryDsn", config)

    @override_settings(DEBUG=False)
    def test_sentry_defaults_when_optional_env_unset(self):
        env = {"SENTRY_DSN": "https://example@o0.ingest.sentry.io/0"}
        with mock.patch.dict("os.environ", env, clear=True):
            config = get_spa_public_config()

        self.assertEqual(config["sentryEnvironment"], "production")
        self.assertEqual(config["sentryTracesSampleRate"], "0")
