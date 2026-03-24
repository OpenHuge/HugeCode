use super::*;

#[test]
fn normalize_research_route_lab_result_payload_marks_missing_sources_as_blocked() {
    let value = json!({
        "recommendedRoute": "route-a",
        "alternativeRoutes": [],
        "decisionMemo": "Prefer route A.",
        "sources": [],
        "confidence": "high",
        "openQuestions": [],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(&value, &[], &[])
        .expect("normalized research payload");
    assert_eq!(
        result.get("blockedReason"),
        Some(&json!("missing_trusted_sources"))
    );
    assert_eq!(result.get("phase"), Some(&json!("gap")));
    assert_eq!(
        result.pointer("/sourceAssessment/status"),
        Some(&json!("insufficient"))
    );
}

#[test]
fn normalize_research_route_lab_result_payload_blocks_untrusted_sources() {
    let value = json!({
        "recommendedRoute": "route-a",
        "alternativeRoutes": [],
        "decisionMemo": "Prefer route A.",
        "sources": [
            {
                "label": "Random blog",
                "url": "https://example.com/post",
                "domain": "example.com"
            }
        ],
        "confidence": "medium",
        "openQuestions": [],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(
        &value,
        &["react.dev".to_string(), "vite.dev".to_string()],
        &["route-a".to_string()],
    )
    .expect("normalized research payload");
    assert_eq!(
        result.get("blockedReason"),
        Some(&json!("untrusted_source_domains:example.com"))
    );
    assert_eq!(
        result.pointer("/sourceAssessment/status"),
        Some(&json!("insufficient"))
    );
}

#[test]
fn normalize_research_route_lab_result_payload_marks_missing_route_as_blocked() {
    let value = json!({
        "recommendedRoute": null,
        "alternativeRoutes": [],
        "decisionMemo": "Need more evidence.",
        "sources": [
            {
                "label": "React 19 upgrade guide",
                "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                "domain": "react.dev"
            }
        ],
        "confidence": "medium",
        "openQuestions": [],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(
        &value,
        &["react.dev".to_string()],
        &["route-a".to_string()],
    )
    .expect("normalized research payload");
    assert_eq!(
        result.get("blockedReason"),
        Some(&json!("missing_recommended_route"))
    );
    assert_eq!(result.get("phase"), Some(&json!("gap")));
}

#[test]
fn normalize_research_route_lab_result_payload_blocks_routes_outside_candidate_set() {
    let value = json!({
        "recommendedRoute": "route-z",
        "alternativeRoutes": [],
        "decisionMemo": "Prefer route z.",
        "sources": [
            {
                "label": "React 19 upgrade guide",
                "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                "domain": "react.dev"
            }
        ],
        "confidence": "high",
        "openQuestions": [],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(
        &value,
        &["react.dev".to_string()],
        &["route-a".to_string(), "route-b".to_string()],
    )
    .expect("normalized research payload");
    assert_eq!(
        result.get("blockedReason"),
        Some(&json!("invalid_recommended_route:route-z"))
    );
    assert_eq!(result.get("phase"), Some(&json!("gap")));
}

#[test]
fn normalize_research_route_lab_result_payload_marks_mixed_sources_as_gap() {
    let value = json!({
        "phase": "selected",
        "recommendedRoute": "route-a",
        "alternativeRoutes": [],
        "decisionMemo": "Prefer route A.",
        "recommendedRouteRationale": "Official React guidance supports the route, but one supporting note came from an untrusted source.",
        "sources": [
            {
                "label": "React 19 upgrade guide",
                "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                "domain": "react.dev"
            },
            {
                "label": "Random blog",
                "url": "https://example.com/post",
                "domain": "example.com"
            }
        ],
        "confidence": "medium",
        "openQuestions": [],
        "coverageGaps": ["Confirm the current Vitest migration guidance."],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(
        &value,
        &["react.dev".to_string()],
        &["route-a".to_string()],
    )
    .expect("normalized research payload");
    assert_eq!(result.get("phase"), Some(&json!("gap")));
    assert_eq!(
        result.pointer("/sourceAssessment/status"),
        Some(&json!("mixed"))
    );
    assert_eq!(
        result.pointer("/recommendedRouteRationale"),
        Some(&json!(
            "Official React guidance supports the route, but one supporting note came from an untrusted source."
        ))
    );
    assert_eq!(
        result.pointer("/coverageGaps/0"),
        Some(&json!("Confirm the current Vitest migration guidance."))
    );
}

#[test]
fn normalize_research_route_lab_result_payload_keeps_trusted_selection() {
    let value = json!({
        "recommendedRoute": "route-a",
        "alternativeRoutes": [],
        "decisionMemo": "Prefer route A.",
        "recommendedRouteRationale": "The official React and Vite guidance align on this route.",
        "sources": [
            {
                "label": "React 19 upgrade guide",
                "url": "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
                "domain": "react.dev"
            },
            {
                "label": "Vite migration guide",
                "url": "https://vite.dev/guide/migration",
                "domain": "vite.dev"
            }
        ],
        "confidence": "high",
        "openQuestions": [],
        "blockedReason": null
    });
    let result = normalize_research_route_lab_result_payload(
        &value,
        &["react.dev".to_string(), "vite.dev".to_string()],
        &["route-a".to_string()],
    )
    .expect("normalized research payload");
    assert_eq!(result.get("phase"), Some(&json!("selected")));
    assert_eq!(result.get("blockedReason"), Some(&Value::Null));
    assert_eq!(
        result.pointer("/sourceAssessment/status"),
        Some(&json!("trusted"))
    );
    assert_eq!(
        result.pointer("/sourceAssessment/trustedSourceCount"),
        Some(&json!(2))
    );
}
