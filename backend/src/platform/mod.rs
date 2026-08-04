//! Generic capabilities integrations are built on, instead of each one
//! shipping its own bespoke Rust.
//!
//! Today that is a single capability: [`fetch`], an allowlisted outbound HTTP
//! call whose target comes only from the checked-in manifest that
//! [`manifest`] loads and validates at boot. An integration declares an
//! endpoint there and calls it by name; it never supplies a URL.
//!
//! The split between the two modules is deliberate. [`manifest`] owns *what
//! is permitted* and proves it once at startup — a malformed manifest stops
//! the process rather than degrading at request time. [`fetch`] owns *what
//! happens per request*, and re-checks the same invariant through the same
//! shared `validate_endpoint_url`, so the two boundaries cannot drift apart.

pub mod fetch;
pub mod manifest;
