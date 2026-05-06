# code-runtime-service-rs `lib_tests_body.inc` 拆分交接

更新时间：2026-05-06

## 背景

目标文件原始规模约 `20678` 行：

- [lib_tests_body.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body.inc)

本轮工作目标不是改逻辑，而是先把超大测试文件按低风险边界拆成多个 `include!` 片段，降低后续继续拆分或定位问题时的上下文负担。

本轮原则：

- 只做结构拆分，不改测试语义
- 每次只拆一个连续区块
- 每次拆完都做 Rust 编译验证
- 不再触碰已经暴露过编码/字符异常的尾部高风险区

## 当前拆分结果

当前已拆出 3 个片段文件：

- [lib_tests_body_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_helpers.inc) `362` 行
- [lib_tests_body_oauth.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_oauth.inc) `565` 行
- [lib_tests_body_runtime_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_runtime_helpers.inc) `714` 行

主文件当前规模：

- [lib_tests_body.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body.inc) `19042` 行

相对原始大文件，当前已经从主文件中抽走约 `1637` 行。

主文件开头当前结构为：

```rust
include!("lib_tests_body_helpers.inc");

include!("lib_tests_body_oauth.inc");

include!("lib_tests_body_runtime_helpers.inc");

async fn spawn_openai_compat_mock_server_with_options(...) { ... }
```

## 已拆分边界

### 1. helper / prelude 区

来源：

- 原始 `lib_tests_body.inc` 最前面的 `use`、通用测试配置、通用请求 helper、fixture loader 等

现位置：

- [lib_tests_body_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_helpers.inc)

边界特征：

- 这是最稳定的一段
- 结束于 `assert_eval_tags_include(...)`
- 后面直接进入认证 / OAuth 测试组

### 2. 认证 / OAuth 测试组

来源：

- `runtime_auth_token_rejects_unauthorized_rpc_events_and_ws_routes`
- `codex_oauth_*`
- `take_pending_codex_oauth_*`
- `oauth_result_html_*`
- `generate_codex_pkce_verifier_matches_codex_cli_length_profile`

现位置：

- [lib_tests_body_oauth.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_oauth.inc)

边界特征：

- 这是主文件前部第一个完整测试组
- 起止都在文件前段，边界天然清楚
- 已经验证过单独 `include!` 引入稳定

### 3. runtime helper + 小型本地单测区

来源：

- `fetch_ready_payload(...)`
- websocket / runtime run 辅助函数
- `run_async_test_on_large_stack*`
- sqlite snapshot seed helper
- `mock_agent_task_runtime(...)`
- `ensure_agent_task_capacity_*`
- `derive_openai_compat_base_url_*`
- `should_fallback_from_responses_to_chat_completions_*`
- `build_rate_limits_snapshot_*`
- `turn_event_replay_buffer_*`
- `prune_*`
- `parse_provider_extension_seeds_*`

现位置：

- [lib_tests_body_runtime_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_runtime_helpers.inc)

边界特征：

- 在当前主文件中位于第一个大 mock server helper 之前
- 是一个连续区块，结束于 `parse_provider_extension_seeds_rejects_extension_alias_collisions`
- 下一段从 `spawn_openai_compat_mock_server_with_options(...)` 开始

## 已做验证

以下命令已经在拆分后的状态下通过：

```powershell
& 'C:\Users\ThinkPad\.cargo\bin\cargo.exe' test --no-run
```

```powershell
& 'C:\Users\ThinkPad\.cargo\bin\cargo.exe' test runtime_auth_token_rejects_unauthorized_rpc_events_and_ws_routes -- --nocapture
```

```powershell
& 'C:\Users\ThinkPad\.cargo\bin\cargo.exe' test codex_oauth_start_returns_authorize_url_and_callback_rejects_missing_code -- --nocapture
```

注意：

- `lib_tests_body_runtime_helpers.inc` 新增后，尚未补一条专门针对这块的独立目标测试记录到本交接文档
- 但它是在编译通过后才保留的

## 当前工作区状态

当前与本轮拆分直接相关的文件状态应为：

- `M` [lib_tests_body.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body.inc)
- `??` [lib_tests_body_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_helpers.inc)
- `??` [lib_tests_body_oauth.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_oauth.inc)
- `??` [lib_tests_body_runtime_helpers.inc](F:\OpenHuge\HugeCode\packages\code-runtime-service-rs\src\lib_tests_body_runtime_helpers.inc)

## 已知风险

### 1. 文件尾部存在历史性高风险区

之前尝试继续拆分时，`lib_tests_body.inc` 尾部附近出现过字符损坏和断裂问题，症状集中在：

- `truncate_chars_with_ellipsis_handles_small_limits`
- `normalize_distributed_dispatch_error_message_truncates_oversized_message`

表现包括：

- `…` 被破坏成异常字符显示
- 重复断裂断言
- 丢失 `}`
- `cargo test` 报语法错误

现状：

- 这块已经恢复
- 当前不要从尾部向前切，也不要在尾部附近做手工行级搬移

### 2. Windows 终端编码会干扰肉眼判断

PowerShell 输出里曾出现：

- `闁?`
- `鈥?`

这不一定代表文件真实 UTF-8 字节就是这样，但会严重干扰局部 patch 判断。

建议：

- 尽量只在清晰边界处整体抽连续区块
- 避免在尾部敏感区做小范围行编辑

## 推荐的后续拆分顺序

### 优先级 1：mock server helpers 整块拆出

起点：

- `spawn_openai_compat_mock_server_with_options(...)`

特征：

- 连续的大段测试服务器构造 helper
- 收益高，体量大
- 边界比后半段业务测试组更清晰

建议目标文件名：

- `lib_tests_body_mock_servers.inc`

### 优先级 2：SSE / runtime stream helpers 拆出

候选范围：

- `find_sse_frame_boundary(...)`
- `parse_sse_json_frame(...)`
- `read_sse_events(...)`
- `read_sse_events_until(...)`
- `read_sse_events_until_turn_completed(...)`

建议目标文件名：

- `lib_tests_body_stream_helpers.inc`

### 优先级 3：再按测试主题组拆

建议按主题拆，不按固定行数拆，例如：

- rpc registry / capabilities
- providers catalog
- native management
- distributed task graph

## 不建议的做法

- 不要从文件尾部开始拆
- 不要一边拆一边顺手“修格式”或“顺便优化”
- 不要跨多个非连续区块同时拆
- 不要把编译验证留到最后一次性跑

## 推荐操作节奏

每次继续拆分时，保持以下节奏：

1. 先用 `rg -n` 标出函数和测试边界
2. 只选择一个连续区块
3. 新建一个 `*.inc`
4. 主文件改成单个 `include!`
5. 立刻运行：

```powershell
& 'C:\Users\ThinkPad\.cargo\bin\cargo.exe' test --no-run
```

6. 如该区块有明显代表性测试，再补一个定向用例

## 交接结论

当前拆分已经从“验证拆分机制是否稳定”阶段，进入“可以继续按大块主题拆分”的阶段。

最关键的结论不是“已经拆了很多”，而是：

- 前 3 个低风险边界已经跑通
- 主文件 `include!` 组织方式已经稳定
- Rust 编译链对这种拆法是接受的
- 后续可以继续从中段大 helper 区和 mock server 区块下手

如果后续继续推进，优先拆 `spawn_openai_compat_mock_server_with_options(...)` 开始的 mock server helper 大段，不要去碰尾部敏感区。
