"""Shared WhatIf admin mutations for REST API and Slack interactions."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from whatif.models import WhatIfQuestion

User = get_user_model()


class WhatIfActionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _require_staff_user(user: User) -> None:
    if not getattr(user, "is_staff", False):
        raise WhatIfActionError("Staff access required.", status_code=403)


def approve_proposed_whatif(*, staff_user: User, question_id: int) -> WhatIfQuestion:
    _require_staff_user(staff_user)
    question = get_object_or_404(WhatIfQuestion.objects.all(), pk=question_id)
    if question.deleted_at is not None:
        raise WhatIfActionError("That question is no longer available.")
    if question.review_status != WhatIfQuestion.ReviewStatus.PENDING:
        raise WhatIfActionError("That question is no longer pending review.")
    prev_status = question.review_status
    question.review_status = WhatIfQuestion.ReviewStatus.APPROVED
    question.is_active = True
    question.save(update_fields=["review_status", "is_active", "updated_at"])
    if (
        prev_status != WhatIfQuestion.ReviewStatus.APPROVED
        and question.proposed_by_id is not None
    ):
        from achievements.services import evaluate_whatif_dece_proposer_for_user

        evaluate_whatif_dece_proposer_for_user(int(question.proposed_by_id))
    return question


def reject_proposed_whatif(*, staff_user: User, question_id: int) -> WhatIfQuestion:
    _require_staff_user(staff_user)
    question = get_object_or_404(WhatIfQuestion.objects.all(), pk=question_id)
    if question.deleted_at is not None:
        raise WhatIfActionError("That question is no longer available.")
    if question.review_status != WhatIfQuestion.ReviewStatus.PENDING:
        raise WhatIfActionError("That question is no longer pending review.")
    question.review_status = WhatIfQuestion.ReviewStatus.REJECTED
    question.is_active = False
    question.save(update_fields=["review_status", "is_active", "updated_at"])
    return question
