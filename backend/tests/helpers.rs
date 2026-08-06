use std::sync::{Arc, Mutex, OnceLock};

use axum::Router;
use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;

pub async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to create test database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    pool
}

pub async fn test_app() -> (Router, SqlitePool) {
    let pool = test_pool().await;
    let app = dashboard_backend::integrations::router(pool.clone());
    (app, pool)
}

/// A `tracing` writer that appends every formatted event into a shared
/// buffer, so a test can assert on what this process *logged* rather than
/// only on what it returned. Needed because `AppError::Internal` renders a
/// generic body to the caller and puts the real message in a
/// `tracing::error!` — which is exactly where a leaked secret, prompt, or
/// response body would land, and the only place it can be observed.
#[derive(Clone, Default)]
pub struct CapturedLogs(Arc<Mutex<Vec<u8>>>);

impl CapturedLogs {
    /// Every line logged by this test process so far that mentions
    /// `marker`. Tests share one global subscriber (only one may be
    /// installed per process) and run in parallel, so each test filters on
    /// something unique to it — a random port, a distinctive path — otherwise
    /// an assertion could pass or fail on another test's output.
    pub fn lines_mentioning(&self, marker: &str) -> String {
        let bytes = self.0.lock().expect("log buffer not poisoned");
        String::from_utf8_lossy(&bytes)
            .lines()
            .filter(|line| line.contains(marker))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl std::io::Write for CapturedLogs {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0
            .lock()
            .expect("log buffer not poisoned")
            .extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for CapturedLogs {
    type Writer = CapturedLogs;

    fn make_writer(&'a self) -> Self::Writer {
        self.clone()
    }
}

/// Installs the capturing subscriber the first time it is called and hands
/// back the shared buffer. `set_global_default` may only succeed once per
/// process, hence the `OnceLock` — every test file that needs log capture
/// shares this one instance within its own test binary.
pub fn captured_logs() -> &'static CapturedLogs {
    static LOGS: OnceLock<CapturedLogs> = OnceLock::new();
    LOGS.get_or_init(|| {
        let logs = CapturedLogs::default();
        let subscriber = tracing_subscriber::fmt()
            .with_writer(logs.clone())
            .with_ansi(false)
            .with_max_level(tracing::Level::TRACE)
            .finish();
        tracing::subscriber::set_global_default(subscriber)
            .expect("no other global tracing subscriber in this test process");
        logs
    })
}
