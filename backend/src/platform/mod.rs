//! Generic capabilities integrations are built on, instead of each one
//! shipping its own bespoke Rust.
//!
//! Today that is a single capability: [`fetch`], which retrieves a URL the
//! caller supplies and caches the response. It deliberately does not restrict
//! which URLs — see
//! `docs/superpowers/specs/2026-08-04-fetch-proxy-trust-model.md`.

pub mod fetch;
