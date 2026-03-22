use std::{
    collections::hash_map::DefaultHasher,
    collections::{HashMap, HashSet, VecDeque},
    fs,
    hash::{Hash, Hasher},
    path::{Component, Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, LazyLock, Mutex,
    },
    time::{Duration, Instant},
};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command as TokioCommand};
use tokio::sync::{Mutex as AsyncMutex, Notify, RwLock};
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{new_id, now_ms, AppContext, RpcError, ServiceConfig, SharedRuntimeState};

pub const DEFAULT_LIVE_SKILLS_NETWORK_BASE_URL: &str = "https://s.jina.ai";
pub const DEFAULT_LIVE_SKILLS_NETWORK_TIMEOUT_MS: u64 = 15_000;
pub const DEFAULT_LIVE_SKILLS_NETWORK_CACHE_TTL_MS: u64 = 20_000;
pub const BUILTIN_LIVE_NETWORK_SKILL_ID: &str = "network-analysis";
pub const BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_ID: &str = "research-orchestrator";
pub const BUILTIN_LIVE_CORE_TREE_SKILL_ID: &str = "core-tree";
pub const BUILTIN_LIVE_CORE_GREP_SKILL_ID: &str = "core-grep";
pub const BUILTIN_LIVE_CORE_READ_SKILL_ID: &str = "core-read";
pub const BUILTIN_LIVE_CORE_WRITE_SKILL_ID: &str = "core-write";
pub const BUILTIN_LIVE_CORE_EDIT_SKILL_ID: &str = "core-edit";
pub const BUILTIN_LIVE_CORE_BASH_SKILL_ID: &str = "core-bash";
pub const BUILTIN_LIVE_CORE_JS_REPL_SKILL_ID: &str = "core-js-repl";
pub const BUILTIN_LIVE_CORE_JS_REPL_RESET_SKILL_ID: &str = "core-js-repl-reset";
pub const BUILTIN_LIVE_CORE_DIAGNOSTICS_SKILL_ID: &str = "core-diagnostics";
pub const BUILTIN_LIVE_CORE_COMPUTER_OBSERVE_SKILL_ID: &str = "core-computer-observe";

const BUILTIN_LIVE_NETWORK_SKILL_VERSION: &str = "1.1.0";
const BUILTIN_LIVE_RESEARCH_ORCHESTRATOR_SKILL_VERSION: &str = "0.1.0";
const BUILTIN_LIVE_CORE_SKILL_VERSION: &str = "1.0.0";
const DEFAULT_LIVE_SKILL_MAX_RESULTS: usize = 5;
const DEFAULT_LIVE_SKILL_MAX_CHARS_PER_RESULT: usize = 1_200;
const MAX_LIVE_SKILL_MAX_RESULTS: usize = 20;
const MAX_LIVE_SKILL_MAX_CHARS_PER_RESULT: usize = 16_000;
const MAX_LIVE_SKILL_RESPONSE_CHARS: usize = 200_000;
const MAX_LIVE_SKILL_RESPONSE_BYTES: usize = 1_000_000;
const MAX_LIVE_SKILL_QUERY_CHARS: usize = 2_048;
const MAX_LIVE_SKILL_NETWORK_CACHE_ENTRIES: usize = 256;
const MAX_LIVE_SKILL_NETWORK_CACHE_BYTES: usize = 8 * 1024 * 1024;
const MAX_CORE_FILE_BYTES: usize = 512 * 1024;
const DEFAULT_CORE_TREE_MAX_DEPTH: usize = 4;
const MAX_CORE_TREE_MAX_DEPTH: usize = 12;
const DEFAULT_CORE_TREE_MAX_ENTRIES: usize = 400;
const MAX_CORE_TREE_MAX_ENTRIES: usize = 4_000;
const DEFAULT_CORE_GREP_MAX_RESULTS: usize = 200;
const MAX_CORE_GREP_MAX_RESULTS: usize = 2_000;
const MAX_CORE_GREP_PATTERN_CHARS: usize = 2_048;
const MAX_CORE_GREP_CONTEXT_LINES: usize = 10;
const MAX_CORE_SHELL_OUTPUT_CHARS: usize = 16_000;
const MAX_CORE_SHELL_CAPTURE_BYTES: usize = 128 * 1024;
const MAX_CORE_SHELL_COMMAND_CHARS: usize = 8_192;
const DEFAULT_CORE_SHELL_TIMEOUT_MS: u64 = 15_000;
const DEFAULT_RESEARCH_MAX_SUB_QUERIES: usize = 4;
const MAX_RESEARCH_MAX_SUB_QUERIES: usize = 8;
const DEFAULT_RESEARCH_MAX_PARALLEL: usize = 3;
const MAX_RESEARCH_MAX_PARALLEL: usize = 6;
const DEFAULT_RESEARCH_FETCH_CONTENT_LIMIT: usize = 3;
const MAX_RESEARCH_FETCH_CONTENT_LIMIT: usize = 5;
const LIVE_SKILL_NETWORK_CACHE_KEY_VERSION: &str = "v3";

include!("live_skills_types.rs");
include!("live_skills_catalog.rs");
include!("live_skills_computer.rs");
include!("live_skills_core.rs");
include!("live_skills_core_bash.rs");
include!("live_skills_core_diagnostics.rs");
include!("live_skills_core_js_repl.rs");
include!("live_skills_core_js_repl_kernel.rs");
include!("live_skills_search.rs");
include!("live_skills_network.rs");
include!("live_skills_research.rs");

#[cfg(test)]
mod tests {
    include!("live_skills_tests_body.inc");
}
