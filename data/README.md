# 数据文件说明

## today.json

这是示例数据文件，包含 4 个站点的示例内容。

### 重要提示

**当前数据是示例数据**，URL 可能不是最新的真实文章链接。要获取真实数据，需要：

1. **实现抓取脚本**：编辑 `scripts/crawler.js`，实现各站点的 HTML 解析逻辑
2. **运行抓取脚本**：执行 `node scripts/crawler.js` 生成真实数据
3. **自动更新**：配置 GitHub Actions 每天自动运行抓取脚本

### 数据来源

- **Material Design**: https://m3.material.io/
- **Microsoft Design**: https://microsoft.design/
- **Google Design**: https://design.google/
- **Figma**: https://www.figma.com/blog/

### 当前示例数据说明

- Microsoft Design 的 URL 已更新为真实文章链接
- 其他站点的 URL 暂时指向主页（需要实现抓取脚本后获取真实文章链接）

### 如何获取真实数据

1. 安装依赖：
   ```bash
   cd scripts
   npm install
   ```

2. 实现抓取逻辑（编辑 `scripts/crawler.js`）：
   - 使用 `cheerio` 解析 HTML
   - 提取文章标题、URL、发布时间等信息
   - 过滤 AI 相关内容

3. 运行抓取脚本：
   ```bash
   npm run crawl
   ```

4. 脚本会自动更新 `data/today.json` 文件
