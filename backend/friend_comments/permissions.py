from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType

from songaday.models import SongResponse

User = get_user_model()

TARGET_SONGADAY_SONGRESPONSE = "songaday.songresponse"


def content_type_for_target_type(target_type: str) -> ContentType | None:
    t = (target_type or "").strip().lower()
    if t == TARGET_SONGADAY_SONGRESPONSE:
        return ContentType.objects.get_for_model(SongResponse)
    return None


def resolve_target(*, target_type: str, object_id: int):
    ct = content_type_for_target_type(target_type)
    if ct is None:
        return None
    model = ct.model_class()
    if model is None:
        return None
    return model.objects.filter(pk=object_id).select_related("user", "user__profile").first()
