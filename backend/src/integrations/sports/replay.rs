//! Snapshot replay mode for the sports widget.
//!
//! When the `SPORTS_REPLAY_DIR` env var is set to a directory of paired
//! `<timestamp>-scoreboard.json` / `<timestamp>-summary.json` files (as
//! produced by `scripts/capture-live-mlb-game.sh`), the route handler
//! short-circuits the live ESPN flow and returns the captured game's data
//! instead. The current snapshot index advances based on wall-clock time
//! since process start, so the dashboard sees the game evolve as it did
//! when captured.
//!
//! Set `SPORTS_REPLAY_INTERVAL_SECS` (default 5) to change the cadence —
//! lower values fast-forward through the game.
//!
//! Once the final snapshot is reached, the replayer stays on it so the
//! end-of-game UI is observable indefinitely.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde_json::Value;

pub struct Snapshot {
    pub scoreboard: Value,
    pub summary: Value,
}

pub struct Replayer {
    snapshots: Vec<Snapshot>,
    start: Instant,
    interval: Duration,
    game_id: String,
}

impl Replayer {
    pub fn from_env() -> Option<Self> {
        let dir = std::env::var("SPORTS_REPLAY_DIR").ok()?;
        let interval_secs: u64 = std::env::var("SPORTS_REPLAY_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);
        match Self::from_dir(Path::new(&dir), Duration::from_secs(interval_secs)) {
            Ok(r) => {
                tracing::info!(
                    "Sports replay enabled: {} snapshots from {} (interval {}s, game {})",
                    r.snapshots.len(),
                    dir,
                    interval_secs,
                    r.game_id,
                );
                Some(r)
            }
            Err(e) => {
                tracing::warn!("Sports replay setup failed for {}: {}", dir, e);
                None
            }
        }
    }

    pub fn from_dir(dir: &Path, interval: Duration) -> Result<Self, String> {
        let game_id = dir
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| format!("Could not derive game id from path: {}", dir.display()))?
            .to_string();

        // Pair files by their timestamp prefix.
        let mut scoreboards: std::collections::BTreeMap<String, PathBuf> = Default::default();
        let mut summaries: std::collections::BTreeMap<String, PathBuf> = Default::default();

        for entry in fs::read_dir(dir).map_err(|e| format!("read_dir {}: {}", dir.display(), e))? {
            let path = entry.map_err(|e| format!("read_dir entry: {}", e))?.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if let Some(stem) = name.strip_suffix("-scoreboard.json") {
                scoreboards.insert(stem.to_string(), path);
            } else if let Some(stem) = name.strip_suffix("-summary.json") {
                summaries.insert(stem.to_string(), path);
            }
        }

        let mut snapshots = Vec::new();
        for (ts, sb_path) in &scoreboards {
            let Some(sum_path) = summaries.get(ts) else {
                continue; // unpaired scoreboards are skipped
            };
            let scoreboard = read_json(sb_path)?;
            let summary = read_json(sum_path)?;
            snapshots.push(Snapshot {
                scoreboard,
                summary,
            });
        }

        if snapshots.is_empty() {
            return Err(format!("No paired snapshots found in {}", dir.display()));
        }

        Ok(Self {
            snapshots,
            start: Instant::now(),
            interval,
            game_id,
        })
    }

    pub fn game_id(&self) -> &str {
        &self.game_id
    }

    /// Return the snapshot whose position matches wall-clock elapsed since
    /// startup. Clamps at the last snapshot so the end-of-game state stays
    /// observable indefinitely.
    pub fn current(&self) -> &Snapshot {
        let elapsed = self.start.elapsed().as_secs();
        let step = self.interval.as_secs().max(1);
        let raw_idx = (elapsed / step) as usize;
        let idx = raw_idx.min(self.snapshots.len() - 1);
        &self.snapshots[idx]
    }
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("read {}: {}", path.display(), e))?;
    serde_json::from_str(&text).map_err(|e| format!("parse {}: {}", path.display(), e))
}
