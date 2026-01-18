# Netlify 分支部署配置说明

## 📋 分支说明

- **main 分支**：正式环境（生产环境）
- **develop 分支**：测试环境（开发/预览环境）

## 🔧 在 Netlify 上配置 develop 分支部署

### 方法 1：在 Netlify 网站设置中配置（推荐）

1. 登录 [Netlify Dashboard](https://app.netlify.com/)
2. 选择你的网站项目（simon-aiweb）
3. 进入 **Site settings** > **Build & deploy** > **Continuous Deployment**
4. 在 **Branch deploys** 部分：
   - 点击 **Add branch deploy**
   - 分支名称输入：`develop`
   - 可以设置一个自定义的部署子域名（可选）
   - 点击 **Save**

5. 配置部署设置：
   - **Production branch**: `main`（保持为 main）
   - **Branch deploys**: 确保 `develop` 分支已启用

### 方法 2：使用 netlify.toml 配置（已配置）

当前项目已包含 `netlify.toml` 配置文件，Netlify 会自动识别并应用配置。

## 🚀 工作流程

### 测试环境（develop 分支）
- 所有新的改动和功能先推送到 `develop` 分支
- GitHub Actions 会自动在 develop 分支上运行抓取脚本
- Netlify 会自动部署 develop 分支到测试环境
- 测试环境 URL: https://696a6ed454961200089f0a04--simon-aiweb.netlify.app/

### 正式环境（main 分支）
- 测试通过后，通过 Pull Request 合并到 `main` 分支
- GitHub Actions 会在 main 分支上运行抓取脚本
- Netlify 会自动部署 main 分支到正式环境
- 正式环境 URL: https://simon-aiweb.netlify.app/（或你的自定义域名）

## 📝 日常开发流程

### 1. 开发新功能
```bash
# 切换到 develop 分支
git checkout develop

# 创建功能分支（可选）
git checkout -b feature/新功能名称

# 开发完成后提交
git add .
git commit -m "添加新功能"
git push origin develop  # 或 git push origin feature/新功能名称
```

### 2. 测试验证
- 在 Netlify 测试环境预览改动
- 确认功能正常后，可以合并到 main

### 3. 合并到正式环境
- 在 GitHub 上创建 Pull Request：`develop` → `main`
- 审查通过后合并
- Netlify 会自动部署到正式环境

## ⚙️ GitHub Actions 配置

- **正式环境自动抓取**: `.github/workflows/crawl.yml` - 每天 0 点自动更新 main 分支
- **测试环境自动抓取**: `.github/workflows/crawl-develop.yml` - 每天 0 点自动更新 develop 分支

## 🔍 检查配置是否生效

1. 在 develop 分支上推送一次改动
2. 在 Netlify Dashboard 查看是否有新的部署
3. 确认测试环境 URL 已更新最新内容

## ⚠️ 注意事项

- **不要直接推送到 main 分支**：所有改动都应先推送到 develop 分支测试
- **保持分支同步**：定期将 main 的更新合并到 develop，保持代码同步
- **测试环境数据**：测试环境的数据会独立更新，不会影响正式环境
