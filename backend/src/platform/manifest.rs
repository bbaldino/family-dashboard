use std::collections::BTreeMap;

use serde::Deserialize;
use url::Url;

use crate::error::AppError;

/// The only `version` this build understands. Bump alongside any breaking
/// change to the manifest shape, and reject anything else in `from_json` —
/// silently parsing a manifest written for a different version is exactly
/// the "degrade at request time instead of failing at boot" outcome this
/// module exists to prevent.
const SUPPORTED_MANIFEST_VERSION: u32 = 1;

/// A validated `manifest.json` — every upstream this process is permitted
/// to contact.
///
/// Loaded once at startup by `main`, which panics if it will not parse or
/// validate: a bad manifest must stop the process rather than surface as a
/// 500 on one endpoint forever.
///
/// The type is a newtype over the private [`RawManifest`] rather than a
/// plain struct with `Deserialize` derived, so that *existing* is the proof
/// of validity. Deriving `Deserialize` directly would have let any caller
/// write `serde_json::from_str::<Manifest>` and obtain an unchecked value,
/// making the guarantee a convention rather than a fact. Validation happens
/// in [`TryFrom<RawManifest> for Manifest`], which `#[serde(try_from)]`
/// routes every deserialization through.
///
/// `deny_unknown_fields` on `RawManifest` and the two structs below is
/// load-bearing: without it a typo like `ttl_sec` or `querry` deserializes
/// to the field's default, silently disabling caching or stripping an
/// endpoint's declared params.
#[derive(Debug, Deserialize)]
#[serde(try_from = "RawManifest")]
pub struct Manifest(RawManifest);

/// The on-disk shape, deserialized then handed to
/// [`TryFrom<RawManifest> for Manifest`] for validation. Private, and never
/// escapes this module: holding a `RawManifest` means "parsed but not yet
/// checked", which is a state no caller should be able to observe.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawManifest {
    version: u32,
    integrations: BTreeMap<String, IntegrationEntry>,
}

impl TryFrom<RawManifest> for Manifest {
    type Error = String;

    /// Where the invariant is actually enforced. Because `Manifest` is
    /// `#[serde(try_from = "RawManifest")]`, this runs on *every*
    /// deserialization path — `Manifest::from_json`, `Manifest::load`, or a
    /// direct `serde_json::from_str::<Manifest>` somewhere in a future
    /// caller. There is no way to construct a `Manifest` that skipped it.
    fn try_from(raw: RawManifest) -> Result<Self, Self::Error> {
        if raw.version != SUPPORTED_MANIFEST_VERSION {
            return Err(format!(
                "unsupported version {} (this build only understands version {}); \
                 update manifest.json or the build",
                raw.version, SUPPORTED_MANIFEST_VERSION
            ));
        }

        // Validated at load, not at request time: a malformed base or path
        // is a deployment error, and an integration that could reach an
        // arbitrary scheme, host, or off-base path would turn this service
        // into an open proxy on the LAN. A prefix check isn't enough here —
        // "https://" on its own satisfies `starts_with("https://")` while
        // naming no host — so the base is parsed as a real URL and both the
        // scheme and the presence of a host are checked explicitly. The
        // path gets the same treatment via `validate_endpoint_url`, shared
        // with `platform::fetch::build_url`.
        for (id, entry) in &raw.integrations {
            for (name, ep) in &entry.endpoints {
                let base = Url::parse(&ep.base)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https") && url.host().is_some());
                let Some(base) = base else {
                    return Err(format!(
                        "{}.{} base must be an absolute http(s) URL with a host, got {:?}",
                        id, name, ep.base
                    ));
                };
                if let Err(msg) = validate_endpoint_url(&base, &ep.path) {
                    return Err(format!("{}.{}: {}", id, name, msg));
                }
            }
        }
        Ok(Manifest(raw))
    }
}

/// One integration's endpoints, keyed by the name a client passes as
/// `{endpoint}` in `POST /api/fetch/{integration}/{endpoint}`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IntegrationEntry {
    pub endpoints: BTreeMap<String, Endpoint>,
}

/// A single declared upstream call.
///
/// `base` and `path` together are the allowlist: they are the *only* source
/// of scheme, host, port, and path for an outbound request, and
/// `validate_endpoint_url` proves at boot that resolving `path` against
/// `base` cannot leave `base`'s origin.
///
/// `query` values may contain `{{param:name}}` placeholders, which is the
/// one place a client-supplied value enters the URL — url-encoded, as a
/// query value only. A param name not appearing in some placeholder here is
/// rejected by `invoke` rather than ignored.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Endpoint {
    /// The allowlist. A request may never influence this value.
    pub base: String,
    /// Resolved against `base`; validated so it cannot retarget the origin.
    pub path: String,
    /// Query keys are fixed by the manifest; values may be
    /// `{{param:name}}` placeholders filled from the request body.
    #[serde(default)]
    pub query: BTreeMap<String, String>,
    /// Server-side cache lifetime. `0` disables caching for this endpoint
    /// on both read and write.
    #[serde(default)]
    pub ttl_secs: u64,
}

impl Manifest {
    /// Deserialize and validate a manifest from JSON.
    ///
    /// A convenience over `serde_json::from_str` that maps the error into
    /// [`AppError`] — **not** the thing that enforces the invariant. That
    /// lives in [`TryFrom<RawManifest> for Manifest`] and runs on every
    /// deserialization path, so a caller who reaches for
    /// `serde_json::from_str::<Manifest>` directly gets the same checks
    /// rather than a silently unvalidated value.
    ///
    /// Named `from_json` rather than `from_str` deliberately: an inherent
    /// `from_str` trips clippy's `should_implement_trait`, and implementing
    /// `std::str::FromStr` to satisfy it would be worse — `FromStr` means
    /// lexical parsing of a value, not "parse JSON and validate", and
    /// nothing needs the trait generically.
    pub fn from_json(raw: &str) -> Result<Self, AppError> {
        serde_json::from_str(raw).map_err(|e| AppError::Internal(format!("manifest: {}", e)))
    }

    /// Read and validate a manifest from disk. `main` calls this at startup
    /// and panics on failure — a bad manifest must stop the process, not
    /// surface as a 500 on one endpoint forever.
    pub fn load(path: &str) -> Result<Self, AppError> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| AppError::Internal(format!("manifest {} unreadable: {}", path, e)))?;
        Self::from_json(&raw)
    }

    /// The manifest lookup `invoke` performs before doing any URL work.
    /// `None` means the client named something that does not exist, which
    /// becomes a 404.
    pub fn endpoint(&self, integration: &str, endpoint: &str) -> Option<&Endpoint> {
        self.0
            .integrations
            .get(integration)?
            .endpoints
            .get(endpoint)
    }
}

/// Resolves `path` against `base` and asserts the result stays on the same
/// origin (scheme, host, and port) as `base` — the actual SSRF boundary —
/// after two textual "intent guards" that reject the common mistakes with a
/// clearer message: a path that isn't root-anchored, and one containing a
/// `..` segment (checked after percent-decoding, since `%2e%2e` is `..` to
/// any HTTP server that decodes it, and traversal can't be caught by the
/// origin check below — it never leaves the host).
///
/// The origin check is what actually does the work. It deliberately does
/// not try to enumerate every way a path string can resolve to a different
/// authority — a network-path reference (`//host/x`), a backslash treated
/// as a slash on http(s) URLs by the WHATWG parser, a control character
/// (tab, CR, LF) stripped before parsing, or some future parser quirk none
/// of us has thought of yet. Instead it resolves the path with `Url::join`
/// and then checks whether the *result* landed on the origin the manifest
/// declared. That's exact regardless of the mechanism a bad path used to
/// get there.
///
/// Shared between `Manifest::from_json` (a bad manifest must fail at boot,
/// not degrade at request time) and `platform::fetch::build_url`, which
/// re-validates per request because its own unit tests build `Endpoint`
/// values directly and bypass `Manifest::from_json` entirely.
pub fn validate_endpoint_url(base: &Url, path: &str) -> Result<Url, String> {
    let decoded = urlencoding::decode(path)
        .map(|c| c.into_owned())
        .unwrap_or_else(|_| path.to_string());

    if !path.starts_with('/') || decoded.split('/').any(|segment| segment == "..") {
        return Err(format!(
            "endpoint path {:?} must be a root-anchored path with no '..' segments",
            path
        ));
    }

    let resolved = base
        .join(path)
        .map_err(|e| format!("failed to resolve endpoint path {:?}: {}", path, e))?;

    if resolved.scheme() != base.scheme()
        || resolved.host_str() != base.host_str()
        || resolved.port_or_known_default() != base.port_or_known_default()
    {
        return Err(format!(
            "endpoint path {:?} resolves off the declared base host",
            path
        ));
    }

    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "version": 1,
      "integrations": {
        "daily-quote": { "endpoints": { "today": {
          "base": "https://zenquotes.io", "path": "/api/today",
          "query": {}, "ttl_secs": 86400 } } }
      }
    }"#;

    #[test]
    fn resolves_a_declared_endpoint() {
        let m = Manifest::from_json(SAMPLE).expect("parses");
        let ep = m.endpoint("daily-quote", "today").expect("found");
        assert_eq!(ep.base, "https://zenquotes.io");
        assert_eq!(ep.ttl_secs, 86400);
    }

    #[test]
    fn unknown_integration_or_endpoint_is_none() {
        let m = Manifest::from_json(SAMPLE).unwrap();
        assert!(m.endpoint("daily-quote", "nope").is_none());
        assert!(m.endpoint("nope", "today").is_none());
    }

    #[test]
    fn rejects_a_base_that_is_not_absolute_https_or_http() {
        let bad = SAMPLE.replace("https://zenquotes.io", "/etc/passwd");
        assert!(Manifest::from_json(&bad).is_err());
    }

    #[test]
    fn rejects_a_non_http_scheme() {
        let file_scheme = SAMPLE.replace("https://zenquotes.io", "file:///etc/passwd");
        assert!(Manifest::from_json(&file_scheme).is_err());

        let gopher_scheme = SAMPLE.replace("https://zenquotes.io", "gopher://evil.example");
        assert!(Manifest::from_json(&gopher_scheme).is_err());
    }

    #[test]
    fn rejects_an_empty_base() {
        let empty = SAMPLE.replace("https://zenquotes.io", "");
        assert!(Manifest::from_json(&empty).is_err());
    }

    #[test]
    fn rejects_a_hostless_base() {
        // "https://" alone satisfies a naive `starts_with("https://")` check
        // while naming no host at all — the case this module exists to
        // catch, since it's indistinguishable from a typo'd manifest entry
        // that would otherwise resolve to nothing (or, with a differently
        // malformed value, somewhere unintended).
        let hostless = SAMPLE.replace("https://zenquotes.io", "https://");
        assert!(Manifest::from_json(&hostless).is_err());
    }

    #[test]
    fn rejects_a_scheme_relative_base() {
        let scheme_relative = SAMPLE.replace("https://zenquotes.io", "//evil.example.com");
        assert!(Manifest::from_json(&scheme_relative).is_err());
    }

    #[test]
    fn error_message_names_the_integration_and_endpoint() {
        let bad = SAMPLE.replace("https://zenquotes.io", "/etc/passwd");
        let err = Manifest::from_json(&bad).unwrap_err().to_string();
        assert!(
            err.contains("daily-quote"),
            "error should name the integration: {err}"
        );
        assert!(
            err.contains("today"),
            "error should name the endpoint: {err}"
        );
    }

    // --- deny_unknown_fields + explicit version check (Final review,
    // "the manifest's boot-time guarantee is defeated by any typo"): a
    // `ttl_secs` typo used to silently disable caching, and a `query` typo
    // used to silently strip an endpoint's declared params, both at request
    // time instead of boot. ---

    #[test]
    fn rejects_a_typo_d_endpoint_field() {
        // "ttl_sec" instead of "ttl_secs" — before deny_unknown_fields, this
        // parsed fine and silently left ttl_secs at its default of 0,
        // disabling caching for the endpoint with no error anywhere.
        let typo = SAMPLE.replace("\"ttl_secs\"", "\"ttl_sec\"");
        assert!(Manifest::from_json(&typo).is_err());
    }

    #[test]
    fn rejects_a_typo_d_query_field() {
        // "querry" instead of "query" — before deny_unknown_fields, this
        // parsed fine and silently left query empty, stripping the
        // endpoint's declared params.
        let typo = SAMPLE.replace("\"query\"", "\"querry\"");
        assert!(Manifest::from_json(&typo).is_err());
    }

    #[test]
    fn rejects_an_unknown_top_level_field() {
        let bad = SAMPLE.replacen('{', "{\"unexpected\": true,", 1);
        assert!(Manifest::from_json(&bad).is_err());
    }

    #[test]
    fn rejects_an_unsupported_version() {
        let bad = SAMPLE.replace("\"version\": 1,", "\"version\": 99,");
        let err = Manifest::from_json(&bad).unwrap_err().to_string();
        assert!(
            err.contains("99") && err.contains('1'),
            "error should name both the given and supported versions: {err}"
        );
    }

    // --- the manifest is validated only at process boot, so a bad edit to
    // the checked-in file leaves `cargo test` green and crash-loops the
    // container at deploy unless something in the suite actually loads it. ---

    /// The point of `#[serde(try_from = "RawManifest")]`: validation is not
    /// something `from_json` does on the way past, it is a property of
    /// deserializing a `Manifest` at all. If this ever fails, someone has
    /// removed the attribute and the invariant is back to being a
    /// convention that any `serde_json::from_str` call site can ignore.
    #[test]
    fn deserializing_directly_still_validates() {
        let hostile = SAMPLE.replace("https://zenquotes.io", "file:///etc/passwd");
        let direct: Result<Manifest, _> = serde_json::from_str(&hostile);
        assert!(
            direct.is_err(),
            "serde_json::from_str::<Manifest> must not bypass validation"
        );

        let wrong_version = SAMPLE.replace("\"version\": 1", "\"version\": 99");
        let direct: Result<Manifest, _> = serde_json::from_str(&wrong_version);
        assert!(direct.is_err(), "the version check must run on every path");

        // ...and the same input through the convenience wrapper agrees.
        assert!(Manifest::from_json(&hostile).is_err());
    }

    #[test]
    fn checked_in_manifest_is_valid() {
        // cargo test's working directory is the package root (backend/),
        // the same relative path main.rs resolves MANIFEST_PATH against.
        Manifest::load("manifest.json").unwrap();
    }

    // --- path validation happens at boot too, not just per-request in
    // platform::fetch::build_url (Fix Round 1, "path validation runs
    // per-request, not at boot"). ---

    #[test]
    fn rejects_a_manifest_whose_path_is_an_absolute_url_to_another_host() {
        let bad = SAMPLE.replace("/api/today", "https://evil.example.com/steal");
        assert!(Manifest::from_json(&bad).is_err());
    }

    #[test]
    fn rejects_a_manifest_whose_path_is_scheme_relative() {
        let bad = SAMPLE.replace("/api/today", "//evil.example.com/steal");
        assert!(Manifest::from_json(&bad).is_err());
    }

    #[test]
    fn rejects_a_manifest_path_with_dot_dot_traversal() {
        let bad = SAMPLE.replace("/api/today", "/api/../../secret");
        assert!(Manifest::from_json(&bad).is_err());
    }

    // --- validate_endpoint_url directly: the origin check is the real
    // boundary, not the textual guards, per Fix Round 1's Critical finding
    // that the textual guards alone are bypassable. ---

    fn zenquotes() -> Url {
        Url::parse("https://zenquotes.io").unwrap()
    }

    #[test]
    fn origin_check_rejects_backslash_treated_as_slash() {
        // WHATWG URL parsing treats `\` as `/` for special (http/https)
        // schemes, so this resolves to the network-path reference
        // `//evil.example.com/x`, which retargets the host. The leading-`/`
        // and no-`..` textual guards both pass this string; only the
        // post-join origin comparison catches it.
        assert!(validate_endpoint_url(&zenquotes(), "/\\evil.example.com/x").is_err());
    }

    #[test]
    fn origin_check_rejects_embedded_control_characters() {
        // The WHATWG parser strips C0 control characters (tab, CR, LF)
        // before parsing, so this also collapses to `//evil.example.com/x`.
        assert!(validate_endpoint_url(&zenquotes(), "/\t/evil.example.com/x").is_err());
    }

    #[test]
    fn origin_check_rejects_percent_encoded_dot_dot_traversal() {
        assert!(validate_endpoint_url(&zenquotes(), "/api/%2e%2e/%2e%2e/secret").is_err());
    }

    #[test]
    fn origin_check_accepts_a_normal_path() {
        let resolved = validate_endpoint_url(&zenquotes(), "/api/today").unwrap();
        assert_eq!(resolved.as_str(), "https://zenquotes.io/api/today");
    }

    #[test]
    fn origin_check_preserves_a_non_default_port() {
        let base = Url::parse("http://192.168.1.42:8123").unwrap();
        let resolved = validate_endpoint_url(&base, "/api/states").unwrap();
        assert_eq!(resolved.port_or_known_default(), Some(8123));
        assert_eq!(resolved.host_str(), Some("192.168.1.42"));
    }
}
