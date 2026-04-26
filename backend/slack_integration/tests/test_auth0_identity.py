from django.contrib.auth import get_user_model
from django.test import TestCase

from slack_integration.auth0_identity import sync_slack_identity_from_auth0_userinfo
from slack_integration.models import SlackIdentity

User = get_user_model()


class Auth0SlackIdentitySyncTests(TestCase):
    def test_creates_slack_identity_from_identities(self):
        user = User.objects.create_user(email="slackuser@example.com", password="secret12345")
        userinfo = {
            "sub": "oauth2|slack|U123456",
            "email": "slackuser@example.com",
            "identities": [
                {
                    "provider": "slack",
                    "user_id": "U999",
                    "connection": "slack",
                    "profileData": {"team_id": "T888", "email": "slackuser@example.com"},
                }
            ],
        }
        sync_slack_identity_from_auth0_userinfo(user, userinfo)
        row = SlackIdentity.objects.get(team_id="T888", slack_user_id="U999")
        self.assertEqual(row.user_id, user.id)

    def test_provider_slack_case_insensitive(self):
        user = User.objects.create_user(email="s2@example.com", password="secret12345")
        sync_slack_identity_from_auth0_userinfo(
            user,
            {
                "identities": [
                    {
                        "provider": "Slack",
                        "user_id": "U1",
                        "profileData": {"team_id": "T1"},
                    }
                ]
            },
        )
        self.assertTrue(SlackIdentity.objects.filter(team_id="T1", slack_user_id="U1").exists())

    def test_skips_non_slack_provider(self):
        user = User.objects.create_user(email="s3@example.com", password="secret12345")
        sync_slack_identity_from_auth0_userinfo(
            user,
            {
                "identities": [
                    {
                        "provider": "google-oauth2",
                        "user_id": "123",
                        "profileData": {},
                    }
                ]
            },
        )
        self.assertEqual(SlackIdentity.objects.count(), 0)

    def test_skips_when_team_id_missing(self):
        user = User.objects.create_user(email="s4@example.com", password="secret12345")
        sync_slack_identity_from_auth0_userinfo(
            user,
            {"identities": [{"provider": "slack", "user_id": "U1", "profileData": {}}]},
        )
        self.assertEqual(SlackIdentity.objects.count(), 0)
