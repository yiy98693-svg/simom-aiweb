# Vercel 生产分支配置指南（正确位置）

## 重要发现

**Production Branch 设置在 "Environments" 中，不在 "Build and Deployment" 中！**

## 正确的操作步骤

### 步骤 1：进入 Environments 设置

1. 在 Vercel 项目页面，点击左侧导航栏的 **Settings**
2. 在左侧设置菜单中，找到并点击 **"Environments"**（环境）
   - 注意：不是 "Build and Deployment"，也不是 "Git"
   - "Environments" 通常在 "Environment Variables" 附近

### 步骤 2：配置生产分支

在 "Environments" 页面中，你应该能看到：

1. **Production Branch** 或 **Branch Tracking** 部分
2. 选择或输入你的生产分支名称：
   - 通常是 `main`（如果你的 GitHub 默认分支是 main）
   - 或者是 `master`（如果是 master）
3. 点击 **"Save"** 保存设置

### 步骤 3：验证配置

1. 返回 **Deployments** 页面
2. 检查是否显示活跃分支
3. 推送到配置的分支应该会自动触发生产部署

## 如果仍然找不到

如果 "Environments" 页面中也没有看到 Production Branch 选项，可能是：

### 情况 1：已自动配置

Vercel 可能已经自动将你的 GitHub 仓库默认分支（通常是 `main`）设置为生产分支。这种情况下：
- 推送到 `main` 分支会自动触发生产部署
- 不需要手动配置

### 情况 2：检查当前部署状态

1. 进入 **Deployments** 页面
2. 查看最新的部署记录
3. 检查部署来源（Source）是否显示为 `main` 分支
4. 如果显示为 `main`，说明已经正确配置

### 情况 3：手动创建部署测试

1. 在 **Deployments** 页面
2. 点击 **"Create Deployment"** 或 **"Redeploy"**
3. 选择 `main` 分支
4. 如果部署成功，说明配置正常

## 关于你的具体情况

根据你的截图：
- ✅ Git 仓库已连接：`liushimeng309-ai/Simom-aiweb`
- ✅ 部署状态：Ready（就绪）
- ✅ 网站可以访问：`https://simom-aiweb.vercel.app/`

**可能的情况：**
1. Production Branch 已经自动设置为 `main`，无需手动配置
2. 网站已经正常工作，只是 Vercel 界面显示"无活跃分支"可能是 UI 显示问题

## 验证网站是否正常工作

请测试以下内容：

1. **访问网站**：`https://simom-aiweb.vercel.app/`
2. **检查数据加载**：打开浏览器控制台（F12），查看是否有错误
3. **测试自动部署**：
   ```bash
   # 在本地做一个小改动
   echo "<!-- test -->" >> index.html
   git add .
   git commit -m "测试自动部署"
   git push origin main
   ```
   然后查看 Vercel Deployments 页面是否有新部署

## 总结

1. **Production Branch 位置**：Settings → **Environments**（不是 Build and Deployment）
2. **可能已自动配置**：如果网站正常工作，可能已经自动配置好了
3. **验证方法**：推送代码到 main 分支，看是否自动部署
