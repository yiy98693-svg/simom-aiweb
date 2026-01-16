# 抓取脚本说明

## 安装依赖

```bash
cd scripts
npm install
```

## 运行抓取脚本

```bash
npm run crawl
```

或直接运行：

```bash
node crawler.js
```

## 部署方式

### GitHub Actions（推荐）

1. 已在 `.github/workflows/crawl.yml` 中配置了自动定时任务
2. 每天 0 点 UTC（北京时间 8 点）自动运行
3. 抓取完成后自动提交 `data/today.json` 到仓库

### 手动部署

1. 配置服务器定时任务（cron）
2. 每天 0 点运行 `node /path/to/scripts/crawler.js`

### 注意事项

1. **需要实现实际的 HTML 解析逻辑**：
   - 当前脚本提供了基础框架，但需要根据各网站的实际 HTML 结构实现解析
   - 建议使用 `cheerio` 库解析 HTML

2. **反爬虫处理**：
   - 部分网站可能有反爬虫机制
   - 需要设置合适的请求头（User-Agent 等）
   - 可能需要处理 JavaScript 渲染的内容（考虑使用 Puppeteer）

3. **错误处理**：
   - 脚本已经包含了基本的错误处理
   - 即使某个站点抓取失败，也会继续处理其他站点

4. **遵守网站条款**：
   - 请遵守各网站的 robots.txt 和使用条款
   - 不要过于频繁地请求，避免给服务器造成压力

## 实现示例

每个抓取函数需要返回以下格式的数组：

```javascript
[
  {
    title: '文章标题',
    url: 'https://example.com/article',
    thumbnail: 'https://example.com/image.jpg',
    summary: '文章摘要',
    tags: ['AI', 'Design'],
    publishedAt: '2026-01-15T10:00:00Z'
  },
  // ...
]
```

然后脚本会自动：
1. 过滤 AI 相关内容
2. 按时间排序
3. 取前 10 条
4. 转换为标准格式并生成 `today.json`
