# code-runtime-service-rs `lib_tests_body.inc` 拆分交接

更新时间：2026-05-06

## 1. 本次工作目标

目标不是改测试逻辑，而是把超大的：

- [lib_tests_body.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body.inc)

按低风险、连续主题块的方式拆成多个 `include!` 文件，降低后续继续拆分、排查测试问题、阅读上下文的成本。

本次始终遵守的原则：

- 只做结构拆分，不改测试行为
- 只拆连续区块，不跨多段拼接
- 每拆一轮立即做 Rust 编译级验证
- 尽量避免碰历史上更脆弱的尾段，优先拆前段和中段的大主题块

## 2. 当前结果

当前所在分支：

- `chore/split-runtime-lib-tests-body`

主文件当前行数：

- [lib_tests_body.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body.inc) `5005` 行

本轮拆分后，当前测试体已经拆成以下文件：

- [lib_tests_body_helpers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_helpers.inc) `362` 行
- [lib_tests_body_oauth.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_oauth.inc) `565` 行
- [lib_tests_body_runtime_helpers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_runtime_helpers.inc) `714` 行
- [lib_tests_body_mock_servers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_mock_servers.inc) `900` 行
- [lib_tests_body_stream_helpers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_stream_helpers.inc) `122` 行
- [lib_tests_body_rpc_and_native_management.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_rpc_and_native_management.inc) `974` 行
- [lib_tests_body_distributed_task_graph.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_distributed_task_graph.inc) `312` 行
- [lib_tests_body_providers_catalog.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_providers_catalog.inc) `434` 行
- [lib_tests_body_workspace_and_codex.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_workspace_and_codex.inc) `901` 行
- [lib_tests_body_agent_tasks.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_agent_tasks.inc) `3213` 行
- [lib_tests_body_models_and_skills.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_models_and_skills.inc) `2991` 行
- [lib_tests_body_events_and_routing.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_events_and_routing.inc) `4203` 行

也就是说，本轮已经把原本的超大单体测试体，拆成了可按主题维护的多个片段。

## 3. 本轮新增的主要拆分主题

### 3.1 mock / stream 基础设施

拆出了：

- `lib_tests_body_mock_servers.inc`
- `lib_tests_body_stream_helpers.inc`

作用：

- 集中存放 mock OpenAI-compatible server、runtime service server、SSE 读取辅助函数
- 这是后面大量路由测试、turn 流测试、provider 路由测试的公共基础设施

### 3.2 RPC / native management / backend / ACP

拆出了：

- `lib_tests_body_rpc_and_native_management.inc`

作用：

- 集中存放 rpc registry、capabilities、native management、runtime backend registry、ACP integration 相关测试
- 这一段是前半段结构最清晰、最适合整体外提的连续主题块之一

### 3.3 distributed task graph

拆出了：

- `lib_tests_body_distributed_task_graph.inc`

作用：

- 集中存放本地 summary candidate 与 distributed task graph RPC 的测试

### 3.4 providers catalog

拆出了：

- `lib_tests_body_providers_catalog.inc`

作用：

- 集中存放 provider catalog、extension provider、strict pool 行为相关测试

### 3.5 workspace / terminal / codex 基础流程

拆出了：

- `lib_tests_body_workspace_and_codex.inc`

作用：

- 集中存放 terminal、workspace CRUD / hydration、手工 codex flow 相关测试

### 3.6 agent task / mission control

拆出了：

- `lib_tests_body_agent_tasks.inc`

作用：

- 集中存放 agent task 生命周期、approval、resume、interrupt、并发控制、mission control 相关测试
- 这是本轮拆出的一个最大主题块

### 3.7 models / live skills / sub-agent / HugeRouter commercial

拆出了：

- `lib_tests_body_models_and_skills.inc`

作用：

- 集中存放 models pool、compat model discovery、live skills、sub-agent、HugeRouter commercial service、prompt library 等测试

### 3.8 events / ws / turn_send routing

拆出了：

- `lib_tests_body_events_and_routing.inc`

作用：

- 集中存放 SSE events、WS route、turn_send provider routing、compat routing、extension routing 等测试
- 这是后半段体量最大、最值得优先拆出的连续区块

## 4. 验证方式与结果

本轮每次拆分后都做了编译级验证，使用的命令是：

```cmd
D:\code\OpenHuge\.tmp_cargo_no_run.cmd
```

注意执行目录必须是：

```txt
D:\code\OpenHuge\HugeCode\packages\code-runtime-service-rs
```

当前结论：

- 本轮拆分后的当前状态，`cargo test --no-run` 通过
- 说明当前拆分仍然属于结构变更，没有引入 include 顺序或作用域错误

## 5. 本轮额外处理的问题

### 5.1 Windows / PowerShell 编码污染

这轮过程中遇到过一次真实的编码污染问题，表现为：

- 个别字符在文件写入后变成乱码
- Rust 报 `invalid utf-8`
- 或者字符字面量、字符串字面量被破坏，导致编译失败

已处理方式：

- 相关文件已经重新洗成有效 UTF-8
- 相关测试和实现已重新验证可编译
- 为了避免 Windows 本地编码再次把省略号字符写坏，[distributed_runtime.rs](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/distributed_runtime.rs) 中把省略号改成了 Rust 的 Unicode 转义写法：

```rust
"\u{2026}"
'\u{2026}'
```

这不是逻辑变更，只是编码稳定性处理。

### 5.2 当前相关文件编码状态

已经检查过本轮涉及的这些文件：

- `lib_tests_body.inc`
- 全部 `lib_tests_body_*.inc`
- `distributed_runtime.rs`

当前都能通过 UTF-8 严格校验，没有继续残留坏字节。

## 6. 当前工作区状态

当前和本轮拆分直接相关的文件状态大致如下：

- `M` [distributed_runtime.rs](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/distributed_runtime.rs)
- `M` [lib_tests_body.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body.inc)
- `??` [lib_tests_body_agent_tasks.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_agent_tasks.inc)
- `??` [lib_tests_body_distributed_task_graph.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_distributed_task_graph.inc)
- `??` [lib_tests_body_events_and_routing.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_events_and_routing.inc)
- `??` [lib_tests_body_mock_servers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_mock_servers.inc)
- `??` [lib_tests_body_models_and_skills.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_models_and_skills.inc)
- `??` [lib_tests_body_providers_catalog.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_providers_catalog.inc)
- `??` [lib_tests_body_rpc_and_native_management.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_rpc_and_native_management.inc)
- `??` [lib_tests_body_stream_helpers.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_stream_helpers.inc)
- `??` [lib_tests_body_workspace_and_codex.inc](/abs/path/D:/code/OpenHuge/HugeCode/packages/code-runtime-service-rs/src/lib_tests_body_workspace_and_codex.inc)
- `M` [code-runtime-service-rs-lib-tests-body-split-handoff-2026-05-06.md](/abs/path/D:/code/OpenHuge/HugeCode/docs/development/code-runtime-service-rs-lib-tests-body-split-handoff-2026-05-06.md)

仓库里另有一些无关的临时文件和未跟踪目录，例如：

- `.corepack/`
- `.tmp-code-t3-ui.err.log`
- `.tmp-code-t3-ui.log`

这些不是本次拆分工作的核心内容。

## 7. 剩余进度判断

本次已经把主文件压到 `5005` 行，离“几千行内”目标已经很近，但这次用户已明确要求先停在总结和交接，不继续拆。

当前剩余主文件的大致内容，主要还是：

- OAuth account / pool / primary account / ChatGPT workspace 相关
- readiness / distributed diagnostics
- local codex sync
- runtime eval fixture

如果后续继续拆，仍然建议按连续主题块继续，不建议回到零散行级微调。

## 8. 后续建议

如果后续要继续推进，建议顺序是：

1. 先提交或保存本轮已经验证通过的拆分结果
2. 后续继续拆时，优先从剩余的 OAuth / readiness / diagnostics 大段下手
3. 每拆一段仍然跑一次：

```cmd
D:\code\OpenHuge\.tmp_cargo_no_run.cmd
```

4. 避免再次用会受本地代码页影响的写法直接落盘 Unicode 文本
5. 对少量特殊字符，优先用 Rust 的 Unicode 转义写法，避免再次出现编码污染

## 9. 本轮结论

本轮不是“只拆了一点”，而是已经完成了可继续维护的阶段性重构：

- 主文件从超大单体显著压缩到 `5005` 行
- 大部分最重的测试主题已经独立成片
- 编译验证链路已经跑通并多轮通过
- 编码污染问题已经定位并收口
- 当前代码状态适合交接，也适合后续继续拆分或直接提交阶段性结果
