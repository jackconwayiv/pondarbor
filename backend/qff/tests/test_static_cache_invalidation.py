"""Static catalog cache: process-local memoization + cross-worker invalidation.

These tests pin the contract that lets ``qff/static_cache.py`` substitute for
direct ORM reads:

* successive calls inside a process return the same object (cache hit);
* calling :func:`bump_generation` from anywhere causes every loader in every
  process to refresh on its next read (cross-worker invalidation);
* :func:`reset_for_test` clears the process-local snapshot so tests don't see
  state from earlier cases.

The test loader counts invocations to make cache hit/miss observable without
poking private internals.
"""

from django.test import TestCase

from qff import static_cache


class StaticCacheInvalidationTests(TestCase):
    def setUp(self):
        static_cache.reset_for_test()
        # Bump once so we are in a known post-init state regardless of cache
        # adapter (LocMem in tests reuses generation across cases).
        static_cache.bump_generation()
        self.calls = 0

        @static_cache.cached_loader("test:loader")
        def _loader() -> int:
            self.calls += 1
            return self.calls

        self.loader = _loader

    def test_repeat_reads_inside_process_hit_cache(self):
        first = self.loader()
        second = self.loader()
        third = self.loader()
        self.assertEqual(first, second)
        self.assertEqual(second, third)
        self.assertEqual(self.calls, 1)

    def test_bump_generation_invalidates_loader(self):
        before = self.loader()
        static_cache.bump_generation()
        after = self.loader()
        self.assertNotEqual(before, after)
        self.assertEqual(self.calls, 2)

    def test_reset_for_test_drops_process_local_snapshot(self):
        self.loader()
        static_cache.reset_for_test()
        self.loader()
        self.assertEqual(self.calls, 2)

    def test_current_generation_is_monotonic(self):
        g0 = static_cache.current_generation()
        static_cache.bump_generation()
        g1 = static_cache.current_generation()
        self.assertGreater(g1, g0)
