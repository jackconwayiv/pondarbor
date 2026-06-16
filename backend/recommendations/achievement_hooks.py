from __future__ import annotations

from achievements.services import (
    evaluate_recommendations_comment_on_other_for_user,
    evaluate_recommendations_five_stars_for_user,
    evaluate_recommendations_share_for_user,
)


def notify_recommendations_entry_shared(*, user_id: int, entry_creator_id: int) -> None:
    evaluate_recommendations_share_for_user(user_id)
    evaluate_recommendations_comment_on_other_for_user(
        user_id,
        entry_creator_id=entry_creator_id,
    )
    evaluate_recommendations_five_stars_for_user(user_id)


def notify_recommendations_review_created(*, user_id: int, entry_creator_id: int) -> None:
    evaluate_recommendations_comment_on_other_for_user(
        user_id,
        entry_creator_id=entry_creator_id,
    )
    evaluate_recommendations_five_stars_for_user(user_id)
