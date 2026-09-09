# Changelog

所有重要变更与 bug 修复记录于此。版本遵循语义化版本（`dsh plugin --profile web add dsh-session-search-toggle` 安装）。

## Unreleased

### 新增：DSH 双版本兼容（0.1.1-rc.2 / 0.1.2-rc.1）

- **单一产物，运行时自适应**：同一份 `lib/client.js` 在两个版本都能加载，无版本号字符串分支。客户端 bundle 只 `require` `react` / `react-dom`，两者都在两版共享模块表内。
- **移除唯一的版本专属值导入**：设置行原先通过 `@deepseek-ai/dsh-client-runtime/client` 的 `defineStore` 建 store；该引擎包在 0.1.2 改名为 `@deepseek-ai/dsh-client-store`，任一值导入都会锁死单版本（0.1.2 下物化即抛 `require(...) missed the module table`，整个客户端半不加载）。
- **store 座位改为本地实现**：座位契约（`StoreHandle` / `StoreInstance`）由 `@deepseek-ai/dsh-client-ui-slots` 拥有、两版一致，渲染层只消费 `getSnapshot` / `subscribe` / `actions`。本地实现约 30 行，覆盖 `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`，并保留 revision 围栏与订阅通知语义；行为由 `tests/client-store.test.mjs` 覆盖（9 项）。
- **快照类型本地镜像**：`SettingsScopeSnapshot<T>` 两版字段相同（status / value / base / user / revision / writable / mode），改为本地结构镜像，避免类型导入指向单一版本。
- **元数据**：`engines.dsh` 收窄为 `>=0.1.0-rc.7 <0.2.0-0`；`peerDependencies` / `devDependencies` 移除 `@deepseek-ai/dsh-client-runtime`；`dsh.client.inject` 改为实际填充的槽位所属包（`@deepseek-ai/dsh-client-ui-settings-general`）；`tsdown` 的客户端 externals 同步去掉 runtime。

### 验证

- `npm test`（`tests/client-store.test.mjs`）：9/9。
- `_smoke/smoke-batch-c.mjs`：主机半路由 + 设置命名空间；客户端半在两张真实模块表（0.1.1-rc.2 预载 `dsh-client-runtime/client` / 0.1.2-rc.1 含 `dsh-client-store`）下各物化一次，`require` 越表即失败，两次注册账本一致。
