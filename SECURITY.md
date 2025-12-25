# 安全说明

> 本文档说明 Reader Assistant 扩展的安全措施和最佳实践。

## 🔒 当前安全风险分析

### 1. **存储风险**
- ✅ **已修复**: 从 `chrome.storage.sync` 改为 `chrome.storage.local`
  - **风险**: Sync 会同步到 Google 云端，如果账户被攻击可能泄露
  - **解决**: Local 存储仅在本机，不跨设备同步

### 2. **使用风险**
- ⚠️ **部分风险**: API key 在 Content Script 中传递
  - **风险**: Content Script 运行在页面上下文中，可能被恶意脚本访问
  - **当前状态**: API key 通过 `AIService` 类在 Content Script 中使用
  - **建议**: 使用 Service Worker 代理模式（已实现，可选启用）

### 3. **内存风险**
- ⚠️ **低风险**: API key 在 JavaScript 对象中
  - **风险**: 通过浏览器调试工具或内存转储可能泄露
  - **缓解**: Service Worker 隔离环境

## 🛡️ 已实施的安全措施

### 1. **本地存储（已实施）** ✅
```typescript
// 使用 chrome.storage.local 而不是 sync
await chrome.storage.local.set({ api_key: apiKey });
```
- ✅ API key 不会同步到云端
- ✅ 仅存储在本地设备
- ✅ 减少云端泄露风险

### 2. **安全提示（已实施）** ✅
- 在 Popup 中添加了安全提示
- 告知用户 API key 仅存储在本地

### 3. **Service Worker 代理模式（已实现，可选）** ✅
- 创建了 `SecureAIService` 类
- API key 仅在 Service Worker 中使用
- Content Script 通过消息传递请求 API 调用

## 📋 推荐的安全最佳实践

### 对用户：
1. **使用专用 API Key**
   - 为扩展创建专用的 API key
   - 设置使用限额和过期时间
   - 定期轮换 API key

2. **限制 API Key 权限**
   - 仅授予必要的权限
   - 设置 IP 白名单（如果支持）
   - 监控 API 使用情况

3. **保护设备安全**
   - 使用强密码保护浏览器账户
   - 定期更新浏览器和扩展
   - 避免在公共设备上使用

### 对开发者：
1. **最小权限原则**
   - 只请求必要的权限
   - 避免使用 `<all_urls>` 如果可能

2. **代码审查**
   - 定期审查代码中的 API key 使用
   - 确保没有硬编码的密钥
   - 使用环境变量（开发环境）

3. **安全更新**
   - 及时修复安全漏洞
   - 关注 Chrome 扩展安全更新

## 🔄 可选增强方案

### 方案 A: 完全启用 Service Worker 代理（推荐）
**优点**:
- API key 完全隔离在 Service Worker 中
- Content Script 无法访问 API key
- 更高的安全性

**缺点**:
- 需要重构现有代码
- 消息传递可能增加延迟

**实施步骤**:
1. 将 `content.ts` 中的 `AIService` 替换为 `SecureAIService`
2. 确保 Service Worker 正确处理所有请求
3. 测试所有功能

### 方案 B: 加密存储
**优点**:
- 即使存储被访问，API key 也是加密的
- 需要主密码才能解密

**缺点**:
- 增加用户复杂度（需要记住密码）
- 实现复杂度较高

### 方案 C: 使用 OAuth 或 Token 代理
**优点**:
- 用户不需要直接提供 API key
- 通过服务器代理，更安全

**缺点**:
- 需要维护服务器
- 增加成本和复杂度

## 📊 当前安全等级

| 风险项 | 风险等级 | 状态 | 说明 |
|--------|---------|------|------|
| 云端同步 | 🟢 低 | ✅ 已修复 | 使用 local storage |
| Content Script 暴露 | 🟡 中 | ⚠️ 部分缓解 | 可通过 Service Worker 完全隔离 |
| 内存泄露 | 🟢 低 | ✅ 可接受 | 浏览器环境限制 |
| 恶意扩展 | 🟡 中 | ⚠️ 需注意 | 用户需谨慎安装扩展 |

## 🚀 下一步建议

1. **短期（已完成）**:
   - ✅ 使用 local storage
   - ✅ 添加安全提示

2. **中期（可选）**:
   - 完全启用 Service Worker 代理模式
   - 添加 API key 验证功能

3. **长期（可选）**:
   - 考虑加密存储选项
   - 添加使用监控和告警

## 📝 代码示例

### 当前实现（已安全）
```typescript
// 使用 local storage
await chrome.storage.local.set({ api_key: apiKey });

// 仅在需要时读取
const config = await StorageService.getConfig();
```

### 可选：Service Worker 代理模式
```typescript
// Content Script 中
const secureService = new SecureAIService();
const summary = await secureService.summarize(content);

// Service Worker 中处理实际 API 调用
// API key 不会暴露到 Content Script
```
