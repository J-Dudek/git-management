//! Appels aux API GitHub / GitLab, faits côté Rust : le token ne quitte jamais le backend.
//! L'interface ne fournit qu'un chemin d'API, toujours appelé sur le serveur du compte.

use std::time::Duration;
use serde_json::Value;
use crate::accounts::{url_host, Account, Provider};

/// Racine de l'API REST d'une instance.
pub fn api_base(provider: Provider, base_url: &str) -> String {
    let base = base_url.trim_end_matches('/');
    match provider {
        Provider::Github if url_host(base).as_deref() == Some("github.com") => "https://api.github.com".into(),
        Provider::Github => format!("{base}/api/v3"),
        Provider::Gitlab => format!("{base}/api/v4"),
    }
}

/// Chemin d'API relatif (avec éventuelle query string), sans possibilité de viser un autre hôte.
pub fn validate_api_path(path: &str) -> Result<(), String> {
    let refused = || format!("Chemin d'API refusé : {path}");
    if !path.starts_with('/') || path.starts_with("//") || path.len() > 2048 {
        return Err(refused());
    }
    let route = path.split('?').next().unwrap_or("");
    if path.contains("://")
        || path.contains('\\')
        || path.chars().any(|c| c.is_control() || c.is_whitespace())
        || route.split('/').any(|seg| seg == ".." || seg == "." || seg.eq_ignore_ascii_case("%2e%2e"))
    {
        return Err(refused());
    }
    Ok(())
}

fn http_error(host: &str, e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(401 | 403, _) => {
            "Token refusé (401/403) : vérifie sa validité et ses droits, ou reconnecte le compte".into()
        }
        ureq::Error::Status(code, response) => {
            let body: String = response.into_string().unwrap_or_default().chars().take(200).collect();
            format!("API {host} : erreur {code} {body}")
        }
        // Le détail distingue une URL erronée d'un certificat non reconnu ou d'un proxy.
        ureq::Error::Transport(t) => format!("Impossible de joindre {host} ({t}) : vérifie l'URL de l'instance et ta connexion"),
    }
}

/// GET JSON authentifié sur l'API du compte.
pub fn get_json(account: &Account, token: &str, path: &str) -> Result<Value, String> {
    validate_api_path(path)?;
    let url = format!("{}{}", api_base(account.provider, &account.base_url), path);
    let host = url_host(&url).unwrap_or_default();
    let mut request = crate::http::agent()
        .get(&url)
        .timeout(Duration::from_secs(30))
        .set("Authorization", &format!("Bearer {token}"))
        .set("User-Agent", "Merathon");
    request = match account.provider {
        Provider::Github => request
            .set("Accept", "application/vnd.github+json")
            .set("X-GitHub-Api-Version", "2022-11-28"),
        Provider::Gitlab => request.set("Accept", "application/json"),
    };
    request
        .call()
        .map_err(|e| http_error(&host, e))?
        .into_json()
        .map_err(|e| format!("Réponse illisible de {host} : {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_per_provider() {
        assert_eq!(api_base(Provider::Github, "https://github.com"), "https://api.github.com");
        assert_eq!(api_base(Provider::Github, "https://ghe.corp.io/"), "https://ghe.corp.io/api/v3");
        assert_eq!(api_base(Provider::Gitlab, "https://gitlab.com"), "https://gitlab.com/api/v4");
    }

    #[test]
    fn api_path_validation() {
        for ok in ["/user", "/repos/o/r/pulls?state=open&per_page=50", "/projects/group%2Frepo/issues"] {
            assert!(validate_api_path(ok).is_ok(), "{ok}");
        }
        for bad in [
            "user",
            "//evil.example/x",
            "/x?u=https://evil.example",
            "/repos/../admin",
            "/a/%2e%2e/b",
            "/a b",
            "/a\nb",
            "/a\\b",
        ] {
            assert!(validate_api_path(bad).is_err(), "{bad:?}");
        }
    }
}
