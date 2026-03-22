# `pi-mono` Runtime 主线源码解剖

Date: 2026-03-22
Status: active
Local implementation baseline: `fastcode` @ `c1623a699002c498526782cddefa291a57b162bf`

## 目的

这不是仓库导览，也不是产品宣传稿。

这份文档只做一件事：沿着当前仓库的 Runtime 主线，把这套 runtime-first mono 仓库的真实代码闭环拆开，解释它如何把：

- `apps/code` 的桌面宿主装配
- `packages/code-workspace-client` 的共享运行时绑定
- `packages/code-runtime-host-contract` 的 frozen contract
- `packages/code-runtime-service-rs` 的 Rust 真相源

串成一个能持续演进的控制面架构。

如果只保留一句总结，这套架构最值得学的不是“功能很多”，而是：

> 前端负责装配、缓存、派生与控制；runtime 才负责生命周期、切片发布、恢复与审计真相。

## 一条主链

```text
apps/code
  createRuntimeKernel()
    -> createWorkspaceClientRuntimeBindings()
      -> WorkspaceClientRuntimeBindings
        -> missionControlSnapshotStore / kernelProjectionStore
          -> code-runtime-host-contract
            -> code-runtime-service-rs
```

这条主链里的角色分工是稳定的：

| 层             | 代表入口                                                                                                                                       | 主要职责                                                   | 不应该拥有的东西           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| 宿主装配层     | `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`                                                                              | 组装 gateway、desktop host、shared runtime bindings        | 业务生命周期真相           |
| 共享运行时边界 | `apps/code/src/application/runtime/kernel/createWorkspaceClientRuntimeBindings.ts`、`packages/code-workspace-client/src/workspace/bindings.ts` | 把 runtime 能力压成统一 bindings                           | 页面局部状态机             |
| 前端状态层     | `missionControlSnapshotStore.ts`、`kernelProjectionStore.ts`                                                                                   | 读取 snapshot、合并 projection delta、处理 resync          | 重新定义 run / review 真相 |
| 合同层         | `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`                                                                                    | 冻结 method、feature、request/response shape               | UI heuristics              |
| Runtime 真相层 | `packages/code-runtime-service-rs/src/rpc_dispatch_kernel.rs`                                                                                  | 发布 mission/control、continuity、diagnostics、jobs 等切片 | 呈现策略                   |

### 结论先说

- `apps/code` 不是核心业务真相源，它是桌面宿主和 runtime 装配层。
- `code-workspace-client` 不是普通共享 UI 包，它是这套架构可复用的真正关键层。
- `code-runtime-host-contract` 不是“类型定义文件夹”，而是前后端演进的硬边界。
- `code-runtime-service-rs` 不是“后端实现细节”，而是 run、continuity、diagnostics、review truth 的唯一来源。

## 第一部分：系统主线图

### 1. `apps/code` 只做宿主装配，不做业务真相

入口在 [`createRuntimeKernel.ts`](../../apps/code/src/application/runtime/kernel/createRuntimeKernel.ts)。

这个文件做的不是“启动业务”，而是把 4 个东西装进一个 kernel：

1. `runtimeGateway`
   面向 runtime 的统一读入口，负责 mode 探测、目标发现、mission control snapshot 读取。
2. `workspaceClientRuntimeGateway`
   把 runtime 模式和 Web gateway 配置转成共享 workspace client 可用的接口。
3. `workspaceClientRuntime`
   通过 `createWorkspaceClientRuntimeBindings()` 生成共享 runtime bindings。
4. `desktopHost`
   宿主能力适配层。

关键点在于：`createRuntimeKernel()` 不自己维护任务、运行、审核、恢复状态。它做的是依赖装配，而不是状态持有。

这就是为什么 `apps/code` 能保持“桌面宿主 + 控制面”的身份，而不会膨胀成第二个 orchestration engine。

### 2. `createWorkspaceClientRuntimeBindings` 是真正的共享边界

入口在 [`createWorkspaceClientRuntimeBindings.ts`](../../apps/code/src/application/runtime/kernel/createWorkspaceClientRuntimeBindings.ts)。

它把桌面侧一堆分散的 runtime 端口压成统一的 `WorkspaceClientRuntimeBindings`：

- `settings`
- `oauth`
- `models`
- `workspaceCatalog`
- `missionControl`
- `kernelProjection`
- `runtimeUpdated`
- `agentControl`
- `threads`
- `git`
- `workspaceFiles`
- `review`

对应的静态类型边界在 [`bindings.ts`](../../packages/code-workspace-client/src/workspace/bindings.ts)。

这层的价值不在“字段很多”，而在它做了两个高价值决定：

1. 桌面和 Web 不直接共享页面逻辑，而是先共享 runtime binding contract。
2. 所有运行时能力都被收敛成一个 shell-agnostic 的接口集合，宿主差异被压回 adapter，而不是扩散到页面。

所以这套仓库不是“桌面一套、Web 一套，然后勉强复用组件”。它真正复用的是 runtime-facing application boundary。

### 3. 前端 store 明确是缓存层，不是真相层

这里最关键的两个 store 是：

- [`missionControlSnapshotStore.ts`](../../packages/code-workspace-client/src/workspace-shell/missionControlSnapshotStore.ts)
- [`kernelProjectionStore.ts`](../../packages/code-workspace-client/src/workspace-shell/kernelProjectionStore.ts)

`missionControlSnapshotStore` 负责：

- 优先从 `kernelProjection` 的 `mission_control` slice 同步快照
- 没有 projection 时，回退到 `runtime.missionControl.readMissionControlSnapshot()`
- 对外只暴露 `snapshot + loadState + error`

`kernelProjectionStore` 负责：

- `bootstrap(scopes)` 获取全量切片初始态
- `subscribe(scopes, lastRevision)` 接受增量 delta
- 通过 `replace / upsert / remove / patch / resync_required` 合并状态
- 在 `resync_required` 时自动 `refresh()`

这两个 store 的设计都体现一个原则：

> 前端拥有的是“如何消费 runtime truth”的机制，而不是“如何重新定义 runtime truth”的权力。

### 4. Contract 是冻结的演进边界

关键入口在 [`codeRuntimeRpc.ts`](../../packages/code-runtime-host-contract/src/codeRuntimeRpc.ts)。

这份文件把几个最重要的事实冻结下来：

- method 名称
- feature flag
- request payload
- response payload
- projection scopes

这里最值得注意的不是单个类型，而是它把 runtime 演进变成“显式发布能力”：

- `MISSION_CONTROL_SNAPSHOT_V1`
- `KERNEL_PROJECTION_BOOTSTRAP_V3`
- `runtime_kernel_projection_v3`
- `runtime_kernel_jobs_v3`

这意味着：

1. 新能力必须先进入 contract，不能只长在客户端。
2. 前端和 Rust runtime 的演进，不靠约定俗成，而靠 frozen method/feature 集。
3. 客户端可以根据 capability 和 feature 做 additive 读取，而不是依赖隐含版本耦合。

### 5. Rust runtime 直接发布切片，而不是让页面自己拼

关键入口在 [`rpc_dispatch_kernel.rs`](../../packages/code-runtime-service-rs/src/rpc_dispatch_kernel.rs)。

这个文件不是普通的“路由分发器”，它本质上是 kernel slice fabric：

- `mission_control`
- `jobs`
- `sessions`
- `capabilities`
- `extensions`
- `continuity`
- `diagnostics`

例如：

- `build_kernel_continuity_slice_payload()` 直接从 mission control run 数据发布 `checkpoint / missionLinkage / reviewActionability / publishHandoff / takeoverBundle`
- `build_kernel_diagnostics_slice_payload()` 直接发布 runtime diagnostics、tool metrics、tool guardrails
- `build_kernel_capabilities_slice_payload()` 把 terminal、backend、extension 暴露成同一套 capability 切片

这就是这套架构的关键分水岭：

- 弱架构：页面自己把多个接口拼成状态面板
- 强架构：runtime 先定义切片，再由前端做轻量消费

## 第二部分：三条关键状态流

### A. Mission Control Snapshot

#### 入口

- 宿主装配入口：`createRuntimeKernel()`
- 共享绑定入口：`createWorkspaceClientRuntimeBindings().missionControl.readMissionControlSnapshot`
- 前端消费入口：`missionControlSnapshotStore.refresh()`

#### 关键数据结构

- `HugeCodeMissionControlSnapshot`
- `MissionControlSnapshotState`

#### 更新机制

1. 前端请求 `readMissionControlSnapshot()`
2. 共享 runtime bindings 优先尝试 `bootstrapKernelProjection({ scopes: ["mission_control"] })`
3. 如果 bootstrap 已拿到 `mission_control` slice，就直接把它视作 `HugeCodeMissionControlSnapshot`
4. 否则回退到 `input.readMissionControlSnapshot()`

这说明 snapshot 读路径本身已经被 projection-aware 化，不是两个完全独立的世界。

#### 失败/回补机制

- 没有 projection 能力时，回退到 snapshot read
- 没有成功读取时，store 只暴露 `loadState: "error"` 和错误文案
- store 自身不尝试发明替代状态

#### 谁拥有真相

- 真相源：runtime snapshot / runtime-published mission_control slice
- 前端：只做 loadState、错误态和缓存

### B. Kernel Projection

#### 入口

- 前端 transport：[`runtimeKernelProjectionTransport.ts`](../../apps/code/src/services/runtimeKernelProjectionTransport.ts)
- 前端状态层：`kernelProjectionStore.ts`
- runtime WebSocket 入口：`lib_transport_rpc.rs`
- runtime slice 生成器：`rpc_dispatch_kernel.rs`

#### 关键数据结构

- `KernelProjectionScope`
- `KernelProjectionBootstrapRequest`
- `KernelProjectionBootstrapResponse`
- `KernelProjectionDelta`
- `KernelProjectionState`

#### 更新机制

标准流程是：

1. `bootstrap(scopes)` 获取当前完整切片
2. 订阅 `kernel.projection.subscribe`
3. runtime 推送 `kernel.projection.delta`
4. `kernelProjectionStore` 根据 op 类型做局部合并

前端 transport 还定义了默认切片集：

- `mission_control`
- `jobs`
- `sessions`
- `capabilities`
- `extensions`
- `continuity`
- `diagnostics`

这让前端可以按需读一个“runtime control-plane fabric”，而不是每个页面单独 invent API。

#### 失败/回补机制

这条流最值得借鉴的是它没有假装“流式订阅永远可靠”。

它显式处理三类失败：

1. `projection_ws_unavailable`
2. `projection_ws_error`
3. `projection_ws_closed`

在这些情况下，transport 不伪装增量同步，而是主动发出 `resync_required` delta。

然后 `kernelProjectionStore`：

- 把状态切成 `loadState: "loading"`
- 设置错误原因
- 自动触发 `refresh()`

这比很多系统“静默断流 + 页面陈旧数据继续渲染”要强得多。

#### 谁拥有真相

- 真相源：runtime 发布的 slice 与 revision
- 前端：只负责 revision-aware merge 与 resync

### C. Runtime Jobs / Continuity

#### 入口

- contract：`runtime_kernel_jobs_v3`
- 前端 bindings：`WorkspaceClientRuntimeAgentControlBindings`
- Rust dispatcher：`handle_kernel_job_get_v3`、`handle_kernel_job_subscribe_v3`
- continuity 切片：`build_kernel_continuity_slice_payload()`

#### 关键数据结构

- `KernelJobStartRequestV3`
- `KernelJob`
- `KernelContinuitySlice`
- `KernelContinuityItem`

#### 更新机制

Runtime jobs v3 说明这套架构不是停在 snapshot/projection 上，而是在把“单个 run/job lifecycle”也统一进 kernel 语义里。

同时 continuity 没有被做成页面派生的“恢复建议”，而是 runtime 原生发布：

- `checkpoint`
- `missionLinkage`
- `reviewActionability`
- `publishHandoff`
- `takeoverBundle`

前端共享摘要层 [`sharedMissionControlSummary.ts`](../../packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts) 再基于这些 runtime-published 字段构造两种 readiness：

- `launchReadiness`
- `continuityReadiness`

这里最强的一点是：launch 与 continuity 没混成一个大状态灯。

#### 失败/回补机制

- run/job 详情通过 contract 明确读取，不靠页面拼接旧 task summary
- continuity 缺字段时，摘要层会老实降级成 `attention / blocked / idle`
- 页面不凭 transcript 或本地 heuristics 补造“可恢复”

#### 谁拥有真相

- 真相源：runtime job payload + runtime continuity slice
- 前端：readiness summarization，不拥有 continuation object

## 第三部分：这套架构为什么强

### 1. Runtime truth 优先，而不是页面状态机优先

为什么强：

- 生命周期只在一个地方成立，恢复、审核、handoff 才不会分叉。
- 前端故障或重载不会破坏 run truth。
- 多控制端可以共享同一份状态，而不是同步多套局部 store。

适合借鉴到什么粒度：

- 直接借“runtime 为真相源”的原则
- 直接借“前端只做 cache/summary/control”

不建议照搬什么：

- 不要为了学这个原则就照抄它的所有 payload 命名
- 不要把每个 UI 派生字段都挪到 runtime

### 2. Shared bindings 优先，而不是平台分叉优先

为什么强：

- 宿主差异被限制在 binding/adaptor，而不是扩散到页面。
- Web 和桌面复用的是 runtime-facing application model，不是只有 UI 组件。
- 新 runtime 能力只需要先接进 bindings，再自然流向共享层。

适合借鉴到什么粒度：

- 直接借“共享运行时绑定 contract”
- 适配借“桌面/Web 都围绕一个 runtime-facing shared layer”

不建议照搬什么：

- 不必机械复制同样多的 binding 分组
- 不要把所有基础设施都塞进一个 mega binding 对象里而失去可维护性

### 3. Contract-first + frozen spec

为什么强：

- 前后端演进不会靠口头同步。
- feature gate 可以清楚表达客户端是否能读某能力。
- additive evolution 更容易做兼容。

适合借鉴到什么粒度：

- 直接借“method/feature/request/response 先冻结，再实现”
- 直接借“客户端按 feature 读能力”

不建议照搬什么：

- 不建议照搬超大单文件 contract 组织方式
- 规模较小的系统可以按领域拆 contract，而不是把所有类型压在一个文件

### 4. Projection fabric 让前端退化成缓存层

为什么强：

- 冷启动可以用 snapshot
- 热更新可以用 delta
- 丢包可以显式 resync

这套组合比“轮询所有页面 + 页面本地 merge”强很多，因为它把一致性策略前置成 runtime/transport 语义。

适合借鉴到什么粒度：

- 直接借 `bootstrap + subscribe + resync_required`
- 适配借 slice 粒度与默认 scopes

不建议照搬什么：

- 不要在切片还不稳定时一次性上太多 scope
- 先从 `mission_control / continuity / diagnostics` 这类高价值切片开始更合理

### 5. Continuity / review truth 是 runtime 一等公民

为什么强：

- 运行完成或中断之后，系统仍然知道下一步该去哪里
- 这让 review、resume、handoff 都能建立在结构化对象上
- 它天然适合多设备、多控制端、长生命周期 run

适合借鉴到什么粒度：

- 直接借 continuation object 的思想
- 适配借字段命名与导航对象

不建议照搬什么：

- 不要先做巨大的 review object 宇宙
- 先把 `checkpoint / handoff / actionability` 这几个核心对象立起来更重要

## 第四部分：迁移借鉴建议

| 类别       | 建议                                       | 说明                                                    |
| ---------- | ------------------------------------------ | ------------------------------------------------------- |
| 直接借鉴   | runtime truth                              | 把 run、review、continuity 真相留在 runtime，不留在页面 |
| 直接借鉴   | shared bindings                            | 先共享 runtime-facing boundary，再共享页面              |
| 直接借鉴   | contract-first                             | method、feature、payload 先冻结再实现                   |
| 直接借鉴   | bootstrap + subscribe + resync             | 这是这套架构最强的状态同步骨架                          |
| 适配借鉴   | kernel jobs v3                             | 中大型 runtime 才值得上完整 job surface                 |
| 适配借鉴   | capabilities / diagnostics additive slices | 很值，但切片数量和粒度要按团队规模收敛                  |
| 适配借鉴   | 多后端显式偏好                             | 多运行后端或多租户场景很值，单后端项目不必过度设计      |
| 不建议照搬 | 超大统一 RPC 面                            | 小中型系统会迅速变得难维护                              |
| 不建议照搬 | 超重 Rust dispatcher 体量                  | 原则值得借，文件规模不值得复制                          |
| 不建议照搬 | 把所有抽象都压进一个 contract 文件         | 会放大认知成本和改动半径                                |

## 最后的判断

如果只从源码角度回答“这套 mono 仓库架构优点到底是什么”，答案不是 React、Rust、Tauri、Cloudflare 这些技术选型本身。

真正的优点是它做成了下面这件事：

1. 用 `apps/code` 保持宿主控制面克制
2. 用 `code-workspace-client` 把平台差异挡在共享边界之外
3. 用 frozen contract 把演进约束成显式能力
4. 用 Rust runtime 发布 snapshot 与 projection 两条读路径
5. 用 continuity/review truth 把运行后的恢复与审查也纳入 runtime 真相体系

这就是为什么它比普通“前端控制台 + 后端接口集合”的 mono 仓库更值得借鉴。

它真正成熟的地方在于：

> 前端不是 orchestration brain，runtime 才是；前端只是一个非常克制但非常强的 control plane。
