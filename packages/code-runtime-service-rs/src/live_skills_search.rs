use globset::{Glob, GlobSet, GlobSetBuilder};
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{sinks::Lossy, BinaryDetection, SearcherBuilder};
use ignore::WalkBuilder;

#[derive(Clone, Copy)]
enum CoreGrepMatchMode {
    Literal,
    Regex,
}

impl CoreGrepMatchMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Literal => "literal",
            Self::Regex => "regex",
        }
    }
}

struct CoreGrepScanRequest {
    workspace_path: PathBuf,
    target: PathBuf,
    pattern: String,
    match_mode: CoreGrepMatchMode,
    case_sensitive: bool,
    whole_word: bool,
    include_hidden: bool,
    max_results: usize,
    context_before: usize,
    context_after: usize,
    include_globs: Vec<String>,
    exclude_globs: Vec<String>,
}

struct CoreGrepScanResult {
    output: String,
    files_scanned: usize,
    dirs_scanned: usize,
    matched_count: usize,
    truncated: bool,
}

fn normalize_core_grep_globs(value: Option<&Vec<String>>) -> Vec<String> {
    let Some(patterns) = value else {
        return Vec::new();
    };
    patterns
        .iter()
        .map(|entry| entry.trim())
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn build_core_grep_globset(patterns: &[String], label: &str) -> Result<Option<GlobSet>, String> {
    if patterns.is_empty() {
        return Ok(None);
    }

    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        let glob = Glob::new(pattern.as_str())
            .map_err(|error| format!("Invalid {label} glob `{pattern}`: {error}"))?;
        builder.add(glob);
    }

    let globset = builder
        .build()
        .map_err(|error| format!("Failed to compile {label} globs: {error}"))?;
    Ok(Some(globset))
}

fn format_core_grep_relative_path(workspace_path: &Path, path: &Path) -> String {
    let relative = path
        .strip_prefix(workspace_path)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    if relative.is_empty() {
        ".".to_string()
    } else {
        relative
    }
}

fn truncate_core_grep_line(line: &str, max_chars: usize) -> String {
    let mut output = String::new();
    for ch in line.chars().take(max_chars) {
        output.push(ch);
    }
    if line.chars().count() > max_chars && max_chars > 0 {
        output.push('…');
    }
    output
}

fn parse_core_grep_match_mode(options: &LiveSkillExecuteOptions) -> Result<CoreGrepMatchMode, String> {
    let normalized = options
        .match_mode
        .as_deref()
        .map(|entry| entry.trim().to_ascii_lowercase());
    match normalized.as_deref() {
        None | Some("") | Some("literal") => Ok(CoreGrepMatchMode::Literal),
        Some("regex") => Ok(CoreGrepMatchMode::Regex),
        Some(other) => Err(format!("matchMode must be `literal` or `regex`, received `{other}`.")),
    }
}

fn build_core_grep_matcher(
    pattern: &str,
    match_mode: CoreGrepMatchMode,
    case_sensitive: bool,
    whole_word: bool,
) -> Result<grep_regex::RegexMatcher, String> {
    let mut builder = RegexMatcherBuilder::new();
    builder.case_insensitive(!case_sensitive);
    builder.word(whole_word);
    if matches!(match_mode, CoreGrepMatchMode::Literal) {
        builder.fixed_strings(true);
    }
    builder
        .build(pattern)
        .map_err(|error| format!("Failed to compile pattern: {error}"))
}

fn read_context_lines(path: &Path) -> Option<Vec<String>> {
    fs::read_to_string(path).ok().map(|content| {
        content
            .lines()
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>()
    })
}

fn scan_core_grep_workspace(request: CoreGrepScanRequest) -> Result<CoreGrepScanResult, String> {
    let target_metadata = fs::metadata(request.target.as_path())
        .map_err(|error| format!("Failed to inspect `{}`: {error}", request.target.display()))?;

    let include_globset = build_core_grep_globset(request.include_globs.as_slice(), "includeGlobs")?;
    let exclude_globset = build_core_grep_globset(request.exclude_globs.as_slice(), "excludeGlobs")?;
    let matcher = build_core_grep_matcher(
        request.pattern.as_str(),
        request.match_mode,
        request.case_sensitive,
        request.whole_word,
    )?;

    let mut output_lines = Vec::new();
    let mut files_scanned = 0usize;
    let mut dirs_scanned = 0usize;
    let mut matched_count = 0usize;
    let mut truncated = false;

    if target_metadata.is_file() {
        files_scanned = 1;
        let relative = format_core_grep_relative_path(
            request.workspace_path.as_path(),
            request.target.as_path(),
        );

        let include_allowed = include_globset
            .as_ref()
            .map(|globset| globset.is_match(relative.as_str()))
            .unwrap_or(true);
        let exclude_blocked = exclude_globset
            .as_ref()
            .map(|globset| globset.is_match(relative.as_str()))
            .unwrap_or(false);

        if include_allowed && !exclude_blocked {
            let remaining = request.max_results.saturating_sub(matched_count);
            let mut file_matches: Vec<(u64, String)> = Vec::new();
            let mut searcher_builder = SearcherBuilder::new();
            searcher_builder.line_number(true);
            searcher_builder.binary_detection(BinaryDetection::quit(b'\x00'));
            let mut searcher = searcher_builder.build();
            let search_result = searcher.search_path(
                &matcher,
                request.target.as_path(),
                Lossy(|line_number, line| {
                    if file_matches.len() >= remaining {
                        return Ok(false);
                    }
                    file_matches.push((
                        line_number,
                        line.trim_end_matches(['\r', '\n']).to_string(),
                    ));
                    Ok(file_matches.len() < remaining)
                }),
            );

            if search_result.is_ok() && !file_matches.is_empty() {
                let context_lines = if request.context_before > 0 || request.context_after > 0 {
                    read_context_lines(request.target.as_path())
                } else {
                    None
                };

                for (line_number, line) in file_matches {
                    if matched_count >= request.max_results {
                        truncated = true;
                        break;
                    }
                    let normalized_line = truncate_core_grep_line(line.as_str(), 500);
                    output_lines.push(format!("{relative}:{line_number}: {normalized_line}"));
                    matched_count += 1;

                    if let Some(context) = context_lines.as_ref() {
                        let current_line = usize::try_from(line_number).unwrap_or(usize::MAX);
                        if current_line == usize::MAX || current_line == 0 {
                            continue;
                        }
                        let start = current_line.saturating_sub(request.context_before).max(1);
                        let end = current_line
                            .saturating_add(request.context_after)
                            .min(context.len());
                        for context_line_number in start..=end {
                            if context_line_number == current_line {
                                continue;
                            }
                            let Some(context_line) = context.get(context_line_number - 1) else {
                                continue;
                            };
                            let trimmed = truncate_core_grep_line(context_line.as_str(), 500);
                            output_lines.push(format!(
                                "{relative}:{context_line_number}- {trimmed}"
                            ));
                        }
                    }
                }
            }
        }

        return Ok(CoreGrepScanResult {
            output: output_lines.join("\n"),
            files_scanned,
            dirs_scanned,
            matched_count,
            truncated,
        });
    }

    if !target_metadata.is_dir() {
        return Err(format!("Path `{}` is neither a file nor a directory.", request.target.display()));
    }

    let mut walk_builder = WalkBuilder::new(request.target.as_path());
    walk_builder.hidden(!request.include_hidden);
    walk_builder.ignore(true);
    walk_builder.git_ignore(true);
    walk_builder.git_exclude(true);
    walk_builder.git_global(true);

    for entry_result in walk_builder.build() {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let Some(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            dirs_scanned += 1;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }

        files_scanned += 1;
        let path = entry.into_path();
        let relative = format_core_grep_relative_path(request.workspace_path.as_path(), path.as_path());

        if include_globset
            .as_ref()
            .map(|globset| !globset.is_match(relative.as_str()))
            .unwrap_or(false)
        {
            continue;
        }
        if exclude_globset
            .as_ref()
            .map(|globset| globset.is_match(relative.as_str()))
            .unwrap_or(false)
        {
            continue;
        }

        let remaining = request.max_results.saturating_sub(matched_count);
        if remaining == 0 {
            truncated = true;
            break;
        }

        let mut file_matches: Vec<(u64, String)> = Vec::new();
        let mut searcher_builder = SearcherBuilder::new();
        searcher_builder.line_number(true);
        searcher_builder.binary_detection(BinaryDetection::quit(b'\x00'));
        let mut searcher = searcher_builder.build();
        let search_result = searcher.search_path(
            &matcher,
            path.as_path(),
            Lossy(|line_number, line| {
                if file_matches.len() >= remaining {
                    return Ok(false);
                }
                file_matches.push((
                    line_number,
                    line.trim_end_matches(['\r', '\n']).to_string(),
                ));
                Ok(file_matches.len() < remaining)
            }),
        );

        if search_result.is_err() || file_matches.is_empty() {
            continue;
        }

        let context_lines = if request.context_before > 0 || request.context_after > 0 {
            read_context_lines(path.as_path())
        } else {
            None
        };

        for (line_number, line) in file_matches {
            if matched_count >= request.max_results {
                truncated = true;
                break;
            }
            let normalized_line = truncate_core_grep_line(line.as_str(), 500);
            output_lines.push(format!("{relative}:{line_number}: {normalized_line}"));
            matched_count += 1;

            if let Some(context) = context_lines.as_ref() {
                let current_line = usize::try_from(line_number).unwrap_or(usize::MAX);
                if current_line == usize::MAX || current_line == 0 {
                    continue;
                }
                let start = current_line.saturating_sub(request.context_before).max(1);
                let end = current_line
                    .saturating_add(request.context_after)
                    .min(context.len());
                for context_line_number in start..=end {
                    if context_line_number == current_line {
                        continue;
                    }
                    let Some(context_line) = context.get(context_line_number - 1) else {
                        continue;
                    };
                    let trimmed = truncate_core_grep_line(context_line.as_str(), 500);
                    output_lines.push(format!("{relative}:{context_line_number}- {trimmed}"));
                }
            }
        }

        if matched_count >= request.max_results {
            truncated = true;
            break;
        }
    }

    Ok(CoreGrepScanResult {
        output: output_lines.join("\n"),
        files_scanned,
        dirs_scanned,
        matched_count,
        truncated,
    })
}

fn resolve_core_grep_pattern<'a>(input: &'a str, options: &'a LiveSkillExecuteOptions) -> Option<&'a str> {
    options
        .pattern
        .as_deref()
        .and_then(|entry| {
            let trimmed = entry.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .or_else(|| {
            options.query.as_deref().and_then(|entry| {
                let trimmed = entry.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            })
        })
        .or_else(|| {
            let trimmed = input.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
}

fn validate_core_grep_pattern(pattern: &str) -> Result<(), String> {
    let pattern_length = pattern.chars().count();
    if pattern_length > MAX_CORE_GREP_PATTERN_CHARS {
        return Err(format!(
            "pattern must be <= {MAX_CORE_GREP_PATTERN_CHARS} characters."
        ));
    }
    Ok(())
}

async fn execute_core_grep_skill(
    resolved_scope: Result<&WorkspaceScope, &String>,
    input: &str,
    options: &LiveSkillExecuteOptions,
    skill_id: &str,
) -> LiveSkillExecutionResult {
    let scope = match resolved_scope {
        Ok(scope) => scope,
        Err(error) => return core_failed_result(skill_id, error.clone(), Value::Null),
    };

    let pattern = match resolve_core_grep_pattern(input, options) {
        Some(pattern) => pattern.to_string(),
        None => {
            return core_failed_result(
                skill_id,
                "pattern is required for core-grep.".to_string(),
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    if let Err(error) = validate_core_grep_pattern(pattern.as_str()) {
        return core_failed_result(
            skill_id,
            error,
            json!({ "workspaceId": scope.workspace_id }),
        );
    }

    let match_mode = match parse_core_grep_match_mode(options) {
        Ok(mode) => mode,
        Err(error) => {
            return core_failed_result(
                skill_id,
                error,
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    let candidate_path = options.path.as_deref().unwrap_or(".");
    let target = match candidate_path {
        "." => scope.workspace_path.clone(),
        _ => match resolve_core_target_path(scope.workspace_path.as_path(), candidate_path) {
            Ok(target) => target,
            Err(error) => {
                return core_failed_result_with_error_code(
                    skill_id,
                    error,
                    CORE_VALIDATION_PATH_ERROR_CODE,
                    json!({ "workspaceId": scope.workspace_id }),
                )
            }
        },
    };

    let include_hidden = options.include_hidden.unwrap_or(false);
    let case_sensitive = options.case_sensitive.unwrap_or(false);
    let whole_word = options.whole_word.unwrap_or(false);
    let max_results = normalize_optional_usize(
        options.max_results,
        DEFAULT_CORE_GREP_MAX_RESULTS,
        1,
        MAX_CORE_GREP_MAX_RESULTS,
    );
    let context_before = normalize_optional_usize(
        options.context_before,
        0,
        0,
        MAX_CORE_GREP_CONTEXT_LINES,
    );
    let context_after = normalize_optional_usize(
        options.context_after,
        0,
        0,
        MAX_CORE_GREP_CONTEXT_LINES,
    );
    let include_globs = normalize_core_grep_globs(options.include_globs.as_ref());
    let exclude_globs = normalize_core_grep_globs(options.exclude_globs.as_ref());

    let request = CoreGrepScanRequest {
        workspace_path: scope.workspace_path.clone(),
        target: target.clone(),
        pattern: pattern.clone(),
        match_mode,
        case_sensitive,
        whole_word,
        include_hidden,
        max_results,
        context_before,
        context_after,
        include_globs: include_globs.clone(),
        exclude_globs: exclude_globs.clone(),
    };

    let scanned = match tokio::task::spawn_blocking(move || scan_core_grep_workspace(request)).await {
        Ok(Ok(scanned)) => scanned,
        Ok(Err(error)) => {
            return core_failed_result(
                skill_id,
                error,
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
        Err(error) => {
            return core_failed_result(
                skill_id,
                format!("Failed to execute core-grep scan: {error}"),
                json!({ "workspaceId": scope.workspace_id }),
            )
        }
    };

    let message = if scanned.matched_count == 0 {
        format!(
            "No matches found for `{}` under `{}`.",
            pattern,
            target.display()
        )
    } else if scanned.truncated {
        format!(
            "Found first {} match(es) for `{}` under `{}` (truncated).",
            scanned.matched_count,
            pattern,
            target.display()
        )
    } else {
        format!(
            "Found {} match(es) for `{}` under `{}`.",
            scanned.matched_count,
            pattern,
            target.display()
        )
    };

    core_completed_result(
        skill_id,
        message,
        scanned.output,
        json!({
            "workspaceId": scope.workspace_id,
            "path": target.display().to_string(),
            "pattern": pattern,
            "matchMode": match_mode.as_str(),
            "caseSensitive": case_sensitive,
            "wholeWord": whole_word,
            "includeHidden": include_hidden,
            "includeGlobs": include_globs,
            "excludeGlobs": exclude_globs,
            "contextBefore": context_before,
            "contextAfter": context_after,
            "maxResults": max_results,
            "filesScanned": scanned.files_scanned,
            "dirsScanned": scanned.dirs_scanned,
            "matchedCount": scanned.matched_count,
            "truncated": scanned.truncated,
        }),
    )
}
