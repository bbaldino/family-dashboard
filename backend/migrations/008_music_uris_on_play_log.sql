-- Persist artist/album URIs alongside display metadata so the ⋮ menu on
-- Recently Played rows can offer "Go to artist" / "Go to album". Old rows
-- stay NULL; the menu hides those actions when the URI is missing.
ALTER TABLE music_explicit_play_log ADD COLUMN artist_uri TEXT;
ALTER TABLE music_explicit_play_log ADD COLUMN album_uri TEXT;
