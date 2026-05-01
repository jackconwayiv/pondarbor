from django.urls import path

from whatif.views import (
    admin_question_detail,
    admin_questions,
    admin_questions_bulk_import,
    admin_questions_pending_count,
    create_session,
    hand_state,
    health,
    join_session,
    list_my_sessions,
    propose_question,
    resume_host_session,
    session_action,
    session_state,
)

urlpatterns = [
    path("health/", health),
    path("questions/", admin_questions),
    path("questions/pending-count/", admin_questions_pending_count),
    path("questions/propose/", propose_question),
    path("questions/bulk-import/", admin_questions_bulk_import),
    path("questions/<int:question_id>/", admin_question_detail),
    path("sessions/", create_session),
    path("sessions/mine/", list_my_sessions),
    path("sessions/<str:code>/resume-host/", resume_host_session),
    path("sessions/<str:code>/", session_state),
    path("sessions/<str:code>/join/", join_session),
    path("sessions/<str:code>/hand/", hand_state),
    path("sessions/<str:code>/action/", session_action),
]

