# 每日 AI 设计情报

一个自动抓取和展示 AI 设计相关内容的网站，每天从各大设计平台（Material Design、Microsoft Design、Google Design、Figma 等）抓取最新的 AI 设计资讯。

## 功能特性

- 🤖 **自动抓取**：每天 0 点自动从官方设计站点抓取最新 AI 相关内容
- 🌐 **多平台支持**：支持 Material Design、Microsoft Design、Google Design、Figma 等多个设计平台
- 🔄 **自动翻译**：自动将英文标题翻译为中文，提升阅读体验
- 📱 **响应式设计**：完美适配桌面和移动设备
- ⚡ **快速加载**：优化的加载动画和骨架屏，提升用户体验

## 项目结构

```
.
├── index.html          # 主页面
├── app.js             # 主要逻辑和数据处理
├── styles.css         # 样式文件
├── data/
│   └── today.json     # 每日数据文件（由爬虫脚本生成）
├── scripts/           # 爬虫脚本（用于生成数据）
└── vercel.json        # Vercel 部署配置
```

## 使用方法

### 本地开发

1. 克隆仓库：
```bash
git clone https://github.com/yiy98693-svg/simom-aiweb.git
cd simom-aiweb
```

2. 启动本地服务器（由于 CORS 限制，需要本地服务器）：
```bash
# 使用 Python
python3 -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000
```

3. 在浏览器中访问：`http://localhost:8000`

### 数据更新

数据文件 `data/today.json` 由爬虫脚本自动生成。如需手动更新，请运行：

```bash
cd scripts
npm install
node crawler.js
```

## 部署

### Netlify

项目已配置为自动部署到 Netlify：
- 网站地址：https://simon-aiweb.netlify.app

### Vercel

项目也支持部署到 Vercel，配置文件已包含在 `vercel.json` 中。

## 技术栈

- 纯 HTML/CSS/JavaScript（无框架依赖）
- 使用 Fetch API 加载数据
- 支持 localStorage 缓存翻译结果

## 数据来源

数据抓取自以下公开网站：
- [Material Design](https://m3.material.io/)
- [Microsoft Design](https://microsoft.design/)
- [Google Design](https://design.google/)
- [Figma](https://www.figma.com)

**注意**：数据抓取自公开网页，仅作学习与收藏导航用途，版权归原网站所有。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
