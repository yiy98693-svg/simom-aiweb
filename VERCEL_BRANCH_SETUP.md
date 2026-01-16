# Vercel 分支配置指南

## 重要说明

**Deploy Hooks 不是问题所在！** Deploy Hooks 仅用于手动触发部署，自动部署不需要它。

## 如何配置生产分支

### 步骤 1：进入 Environments 设置

1. 在 Vercel 项目页面，点击左侧导航栏的 **Settings**
2. 在左侧设置菜单中，点击 **"Environments"**（环境设置）
3. 找到 **"Production Branch"** 或 **"Branch Tracking"** 部分

### 步骤 2：设置生产分支

在 "Production Branch" 设置中：

1. **确认分支名称**：通常应该是 `main` 或 `master`
   - 如果你的 GitHub 仓库默认分支是 `main`，就设置为 `main`
   - 如果是 `master`，就设置为 `master`

2. **保存设置**：点击 "Save" 按钮

### 步骤 3：验证配置

配置完成后：

1. 返回 **Deployments** 页面
2. 检查是否显示活跃分支
3. 推送到 `main` 分支的代码应该会自动触发部署

## 当前状态检查

根据你的截图，Git 仓库已经正确连接：
- ✅ 仓库：`liushimeng309-ai/Simom-aiweb`
- ✅ 连接时间：22 小时前

需要检查的是：
- ⚠️ **Build and Deployment** → **Production Branch** 是否设置为 `main`

## 如果仍然显示"无活跃分支"

如果配置后仍然显示"无活跃分支"，请尝试：

### 方法 1：手动触发部署

1. 在 Vercel 控制台，进入 **Deployments** 页面
2. 点击右上角的 **"Redeploy"** 按钮
3. 选择最新的部署，点击 **"Redeploy"**

### 方法 2：检查 GitHub 分支

1. 确认你的 GitHub 仓库有 `main` 分支
2. 确认 `main` 分支有代码提交
3. 在 Vercel 的 **Deployments** 页面，点击 **"Create Deployment"**
4. 选择 `main` 分支进行部署

### 方法 3：重新连接 Git 仓库

如果以上方法都不行：

1. 进入 **Settings** → **Git**
2. 点击 **"Disconnect"** 断开连接
3. 重新连接 GitHub 仓库
4. 选择正确的分支（`main`）

## 验证部署是否正常工作

配置完成后，测试自动部署：

1. 在本地修改一个文件（比如在 README.md 中添加一行）
2. 提交并推送到 `main` 分支：
   ```bash
   git add .
   git commit -m "测试自动部署"
   git push origin main
   ```
3. 在 Vercel 的 **Deployments** 页面查看是否有新的部署自动创建

## 关于 Deploy Hooks

**Deploy Hooks 是可选的**，主要用于：
- 手动触发部署（不通过 Git push）
- CI/CD 集成
- 外部服务触发部署

对于正常的 Git 自动部署，**不需要**配置 Deploy Hooks。

## 总结

1. ✅ Git 仓库已连接（不需要修改）
2. ❌ 需要检查 **Build and Deployment** → **Production Branch** 设置
3. ❌ Deploy Hooks 不是必需的，可以忽略
