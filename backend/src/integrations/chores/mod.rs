pub mod assignments;
pub mod chores_crud;
pub mod models;
pub mod people;
pub mod weeks;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "chores";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .merge(people::router(pool.clone()))
        .merge(chores_crud::router(pool.clone()))
        .merge(assignments::router(pool.clone()))
        .merge(weeks::router(pool.clone()))
}
