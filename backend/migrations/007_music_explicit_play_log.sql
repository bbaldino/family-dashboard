-- Plays the user explicitly selected through the dashboard (/play endpoint).
-- Separate from music_play_log (which captures every track that became the
-- currently-playing item, including radio followups and album auto-advance)
-- so "Recently Played" can show only what the user actually chose.
CREATE TABLE IF NOT EXISTS music_explicit_play_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    artist TEXT NOT NULL DEFAULT '',
    album TEXT,
    image_url TEXT,
    played_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_music_explicit_play_log_uri ON music_explicit_play_log(uri);
CREATE INDEX IF NOT EXISTS idx_music_explicit_play_log_played_at ON music_explicit_play_log(played_at);
