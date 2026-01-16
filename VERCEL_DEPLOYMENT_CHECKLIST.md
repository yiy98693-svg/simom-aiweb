# Vercel 部署检查清单

## 已完成的配置

✅ 已创建 `vercel.json` 配置文件
✅ 确保 `index.html` 在项目根目录
✅ 确保 `data/today.json` 文件存在

## 需要检查的事项

### 1. Vercel 项目设置

在 Vercel 控制台检查以下设置：

- **Framework Preset**: 选择 "Other" 或 "None"（静态网站）
- **Root Directory**: 留空或设置为 `./`（项目根目录）
- **Build Command**: 留空（静态网站不需要构建）
- **Output Directory**: 留空或设置为 `./`
- **Install Command**: 留空（除非有依赖需要安装）

### 2. 检查部署日志

1. 登录 Vercel 控制台
2. 进入你的项目
3. 查看 "Deployments" 标签页
4. 点击最新的部署记录
5. 查看 "Build Logs" 和 "Runtime Logs"

**常见错误：**
- ❌ "Build Command failed" - 检查是否设置了不必要的构建命令
- ❌ "File not found" - 检查文件路径是否正确
- ❌ "Module not found" - 检查是否有未安装的依赖

### 3. 检查域名配置

1. 在 Vercel 项目设置中查看 "Domains"
2. 确认域名已正确配置
3. 如果使用自定义域名，检查 DNS 设置：
   - A 记录或 CNAME 记录是否正确
   - DNS 传播可能需要几分钟到几小时

### 4. 测试访问

访问以下 URL 测试：

- `https://你的域名.vercel.app/` - 应该显示首页
- `https://你的域名.vercel.app/data/today.json` - 应该返回 JSON 数据
- `https://你的域名.vercel.app/index.html` - 应该显示首页

### 5. 浏览器控制台检查

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页
3. 查看 Network 标签页
4. 检查是否有以下错误：
   - ❌ 404 错误（文件未找到）
   - ❌ CORS 错误（跨域问题）
   - ❌ 网络错误（连接失败）

### 6. 常见问题排查

#### 问题：页面显示空白
- 检查浏览器控制台是否有 JavaScript 错误
- 检查 `app.js` 是否正确加载
- 检查 `data/today.json` 是否可以访问

#### 问题：显示 "数据加载失败"
- 检查 `data/today.json` 文件是否存在
- 检查 JSON 文件格式是否正确
- 检查网络请求是否成功（在 Network 标签页查看）

#### 问题：域名无法访问
- 检查 Vercel 部署状态是否为 "Ready"
- 检查域名 DNS 配置
- 尝试访问 Vercel 提供的默认域名（`*.vercel.app`）

#### 问题：部署成功但页面错误
- 清除浏览器缓存
- 尝试无痕模式访问
- 检查 Vercel 的缓存设置

## 快速修复步骤

如果部署失败，按以下步骤操作：

1. **重新部署**：
   ```bash
   # 在项目根目录
   vercel --prod
   ```

2. **检查 Vercel 设置**：
   - 登录 Vercel 控制台
   - 进入项目设置
   - 检查所有配置项

3. **查看部署日志**：
   - 在 Vercel 控制台查看详细的错误信息

4. **测试本地**：
   ```bash
   # 确保本地可以正常运行
   python3 -m http.server 8000
   # 访问 http://localhost:8000
   ```

## 如果问题仍然存在

请提供以下信息以便进一步排查：

1. Vercel 部署日志的完整内容
2. 浏览器控制台的错误信息
3. Network 标签页中失败的请求详情
4. 你的 Vercel 项目设置截图
