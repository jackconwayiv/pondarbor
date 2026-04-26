# config/middleware.py
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