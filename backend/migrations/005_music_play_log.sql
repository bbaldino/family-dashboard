CREATE TABLE IF NOT EXISTS music_play_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT NOT NULL,
    name TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    album TEXT,
    image_url TEXT,
    played_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_music_play_log_uri ON music_play_log(uri);
CREATE INDEX IF NOT EXISTS idx_music_play_log_played_at ON music_play_log(played_at);
