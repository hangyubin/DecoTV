# DecoTV Cloudflare Pages 部署指南

本文档提供将 DecoTV 项目部署到 Cloudflare Pages 的详细步骤和配置说明。

## 前置条件

- Cloudflare 账户
- GitHub 或 GitLab 仓库（已包含修改后的 DecoTV 代码）
- 基本的 Cloudflare Pages 知识

## 项目修改内容概述

为了适应 Cloudflare Pages 环境，我们进行了以下修改：

1. **配置文件修改**：
   - 创建了 Cloudflare Pages 所需的 `_headers` 和 `_redirects` 文件
   - 添加了 `cloudflare.toml` 配置文件
   - 修改了 `next.config.js` 以支持静态导出

2. **代码调整**：
   - 移除了对 Node.js 文件系统 (`fs`, `path`) 的依赖
   - 修改了配置加载逻辑，避免服务器端文件操作
   - 确保默认使用 localStorage 作为存储方式

3. **构建流程优化**：
   - 更新了构建命令，添加 `next export` 步骤
   - 配置了正确的输出目录

## Cloudflare Pages 部署步骤

### 1. 连接仓库

1. 登录 Cloudflare 仪表板
2. 导航到 **Pages** → **创建项目** → **连接到 Git**
3. 选择您的 GitHub 或 GitLab 仓库
4. 点击 **开始设置**

### 2. 配置构建设置

在项目设置页面中，配置以下选项：

- **项目名称**：DecoTV（或您喜欢的名称）
- **生产分支**：`main` 或 `master`（或您要部署的分支）
- **构建命令**：`pnpm install && pnpm build`
- **构建输出目录**：`out`
- **根目录**：`/`（默认为项目根目录）

### 3. 配置环境变量

在环境变量部分添加以下变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产和预览 |
| `NEXT_PUBLIC_STORAGE_TYPE` | `localstorage` | 生产和预览 |

### 4. 高级设置

- **构建系统版本**：设置为最新的 Node.js 版本（推荐 18+）
- **构建超时时间**：可设置为 15 分钟（默认通常足够）

### 5. 开始部署

点击 **保存并部署** 开始部署过程。Cloudflare Pages 将自动：
1. 克隆您的仓库
2. 安装依赖
3. 构建项目
4. 部署到 Cloudflare Pages 网络

## 部署后的配置

### 自定义域设置（可选）

1. 部署成功后，点击 **自定义域** 选项卡
2. 点击 **设置自定义域**
3. 输入您想要使用的域名
4. 按照 Cloudflare 的指导完成 DNS 设置

### 预览部署

Cloudflare Pages 会为每个 PR 和提交自动创建预览部署，您可以在 **部署** 选项卡中查看这些部署。

## 注意事项

1. **API 功能限制**：
   - Cloudflare Pages 主要用于静态内容托管
   - 原项目中的服务器端 API 路由在静态导出后将不可用
   - 用户数据存储将默认使用 localStorage

2. **存储方式**：
   - 为了在 Cloudflare Pages 环境中正常工作，确保使用 localStorage 作为存储方式
   - 其他存储方式（如 Redis、Upstash）需要额外配置或使用 Cloudflare Workers

3. **性能优化**：
   - Cloudflare Pages 会自动提供全球 CDN 缓存
   - 静态资源会自动优化和缓存

## 故障排除

### 常见问题及解决方案

1. **构建失败**：
   - 检查依赖安装是否成功
   - 确保 Node.js 版本兼容
   - 查看构建日志中的具体错误信息

2. **页面加载问题**：
   - 检查静态资源路径是否正确
   - 验证 _redirects 文件中的路由规则
   - 确认 API 调用已适配为客户端调用

3. **存储相关问题**：
   - 确保代码正确使用 localStorage
   - 检查浏览器开发者工具中的控制台错误

### 本地验证

在部署前，您可以使用项目中提供的 `build-test.bat` 脚本在本地验证构建是否成功：

```bash
# 在 Windows 命令提示符中运行
./build-test.bat

# 或在 PowerShell 中运行
.uild-test.bat
```

## 后续维护

1. **更新项目**：推送到主分支的更改会自动触发新的部署
2. **配置更新**：可以在 Cloudflare Pages 项目设置中随时更新环境变量和构建配置
3. **监控**：使用 Cloudflare 仪表板监控部署状态和性能

## 联系支持

如果遇到部署问题，请：
1. 检查 Cloudflare 文档
2. 查看构建日志中的错误信息
3. 在 GitHub 仓库中提交 Issue

---

祝您部署顺利！