# config/middleware.py
"""HTTP request timing.

For POST /qff/command/, ``queries`` counts every SQL execution during the full WSGI
hop (Auth0/session lookup before the view, the command handler, response build).

When the command view sets ``_qff_cmd_handler_queries`` on the underlying
``HttpRequest`` (required for DRF ``@api_view`` wrappers), that value counts
only queries executed while ``command_view`` holds its inner
``connection.execute_wrapper`` — i.e. handler work after routing (sync + exec +
lazy sim + session payload). The difference ``queries - handler_queries`` is work
outside that wrapper (typically authentication and anything before the inner
counter starts). Compare this delta to ``qff_command_timing queries=`` (same as
handler_queries for successful commands) when tuning DB vs auth overhead.
"""
import time
import logging
from django.db import connection

logger = logging.getLogger("request_timing")

class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        query_count = 0
        query_ms = 0.0

        def wrapper_execute(execute, sql, params, many, context):
            nonlocal query_count, query_ms
            query_count += 1
            start = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                query_ms += (time.perf_counter() - start) * 1000

        start = time.perf_counter()
        with connection.execute_wrapper(wrapper_execute):
            response = self.get_response(request)

        total_ms = (time.perf_counter() - start) * 1000
        qff_total_ms = getattr(request, "_qff_command_total_ms", None)
        handler_queries = getattr(request, "_qff_cmd_handler_queries", None)
        if qff_total_ms is not None:
            outside_ms = max(0.0, total_ms - float(qff_total_ms))
            if handler_queries is not None:
                outside_queries = query_count - int(handler_queries)
                logger.info(
                    "request_timing method=%s path=%s status=%s total_ms=%.1f db_ms=%.1f queries=%s app_ms=%.1f qff_total_ms=%.1f outside_ms=%.1f handler_queries=%s outside_queries=%s",
                    request.method,
                    request.path,
                    response.status_code,
                    total_ms,
                    query_ms,
                    query_count,
                    total_ms - query_ms,
                    float(qff_total_ms),
                    outside_ms,
                    handler_queries,
                    outside_queries,
                )
            else:
                logger.info(
                    "request_timing method=%s path=%s status=%s total_ms=%.1f db_ms=%.1f queries=%s app_ms=%.1f qff_total_ms=%.1f outside_ms=%.1f",
                    request.method,
                    request.path,
                    response.status_code,
                    total_ms,
                    query_ms,
                    query_count,
                    total_ms - query_ms,
                    float(qff_total_ms),
                    outside_ms,
                )
        else:
            logger.info(
                "request_timing method=%s path=%s status=%s total_ms=%.1f db_ms=%.1f queries=%s app_ms=%.1f",
                request.method,
                request.path,
                response.status_code,
                total_ms,
                query_ms,
                query_count,
                total_ms - query_ms,
            )
        return response