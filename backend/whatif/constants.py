# TV scoreboard reveal animation (ms); keep in sync with frontend whatifScoreboardRevealAnimation.ts
SCOREBOARD_REVEAL_HOLD_MS = 2000
SCOREBOARD_REVEAL_DELTA_IN_MS = 500
SCOREBOARD_REVEAL_SCORE_COUNT_MS = 750
SCOREBOARD_REVEAL_SETTLE_MS = 1000
SCOREBOARD_REVEAL_REORDER_MS = 500
SCOREBOARD_REVEAL_TOTAL_MS = (
    SCOREBOARD_REVEAL_HOLD_MS
    + SCOREBOARD_REVEAL_DELTA_IN_MS
    + SCOREBOARD_REVEAL_SCORE_COUNT_MS
    + SCOREBOARD_REVEAL_SETTLE_MS
    + SCOREBOARD_REVEAL_REORDER_MS
)

# After scoreboard animation completes, hold post_results before declaring winner / game over.
DECLARE_WINNER_HOLD_AFTER_SCOREBOARD_MS = 2000

# Hand “next turn” unlocks when TV scoreboard reveal animation finishes (see SCOREBOARD_REVEAL_TOTAL_MS).
VOTING_DEADLINE_SECONDS = 60
# After voting_deadline_at passes, the TV shows "Time's up!" for this many seconds before the
# server auto-reveals. Gives players a clear last-second visual beat.
VOTING_TIME_UP_GRACE_SECONDS = 6

WHATIF_MAX_ENTITIES = 8
SUBJECT_DIE_FACES = 6

# Open/pre-lobby sessions older than this are auto-closed when a user visits the WhatIf entry page.
STALE_OPEN_LOBBY_AGE_HOURS = 24
