/**
 * AI 设计资讯抓取脚本
 * 每天 0 点自动抓取 12 个官方设计网站的最新 AI 相关内容
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// ====================
// 配置
// ====================
const CONFIG = {
  OUTPUT_PATH: path.join(__dirname, '../data/today.json'),
  AI_KEYWORDS: [
    'AI', 'Artificial Intelligence', 'Machine Learning', 'Deep Learning',
    '人工智能', 'Copilot', 'Gemini', '生成式', 'ChatGPT', 'GPT',
    'Assistant', 'Agent', 'Auto', 'Smart', 'Neural', 'LLM', '模型',
    'Firefly', 'Claude', 'DALL-E', 'Midjourney', 'Stable Diffusion'
  ],
  MAX_ITEMS_PER_SITE: 10,
  REQUEST_DELAY: 2000, // 请求延迟（毫秒）
  REQUEST_TIMEOUT: 60000, // 请求超时（毫秒）- 增加到60秒
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// ====================
// 工具函数
// ====================

// HTTP 请求封装（支持超时和重定向）
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const maxRedirects = options.maxRedirects || 5;
    let redirectCount = 0;
    
    const makeRequest = (requestUrl) => {
      const client = requestUrl.startsWith('https') ? https : http;
      const timeout = options.timeout || CONFIG.REQUEST_TIMEOUT;
      
      try {
        const urlObj = new URL(requestUrl);
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + (urlObj.search || ''),
          method: 'GET',
          headers: {
            'User-Agent': CONFIG.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            // 移除 Accept-Encoding，避免需要解压gzip内容
            'Connection': 'keep-alive',
            ...options.headers
          },
          timeout: timeout
        };

        const req = client.request(requestOptions, (res) => {
          // 处理重定向
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
              reject(new Error(`Too many redirects (${redirectCount})`));
              return;
            }
            
            let redirectUrl = res.headers.location;
            // 处理相对URL
            if (!redirectUrl.startsWith('http')) {
              try {
                const baseUrl = new URL(requestUrl);
                redirectUrl = new URL(redirectUrl, baseUrl.origin).href;
              } catch (e) {
                reject(new Error(`Invalid redirect URL: ${redirectUrl}`));
                return;
              }
            }
            
            // 清空响应数据，继续跟随重定向
            res.resume(); // 清空响应流
            return makeRequest(redirectUrl);
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }

          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        req.end();
      } catch (urlError) {
        reject(new Error(`Invalid URL: ${requestUrl} - ${urlError.message}`));
      }
    };
    
    makeRequest(url);
  });
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查文本是否包含 AI 关键词
function isAIRelated(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return CONFIG.AI_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

// 解析日期字符串
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // 尝试多种日期格式
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // 处理相对日期（如 "May 20, 2025"）
    const months = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
      'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    const match = dateStr.toLowerCase().match(/(\w+)\s+(\d+),?\s+(\d+)/);
    if (match) {
      const month = months[match[1]];
      const day = parseInt(match[2]);
      const year = parseInt(match[3]);
      if (month !== undefined) {
        return new Date(year, month, day).toISOString();
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// 计算相对时间
function getRelativeTime(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) {
      return '刚刚';
    } else if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else if (diffMonths < 12) {
      return `${diffMonths}个月前`;
    } else {
      return `${diffYears}年前`;
    }
  } catch (e) {
    return '';
  }
}

// 格式化日期
function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 提取标签（从文本中提取关键词）
function extractTags(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  const tags = [];
  const tagKeywords = {
    'AI': ['ai', 'artificial intelligence', 'machine learning', '人工智能'],
    '设计系统': ['design system', 'design kit', '组件', 'component'],
    '用户体验': ['ux', 'user experience', '用户体验', '界面设计'],
    '工具': ['tool', 'toolkit', '工具', '平台'],
    '生成式': ['generative', '生成式', '生成', 'create'],
    'Copilot': ['copilot', '助手', 'assistant'],
    'Firefly': ['firefly', 'adobe firefly'],
    'Gemini': ['gemini', 'google gemini'],
    'Claude': ['claude', 'anthropic'],
    'ChatGPT': ['chatgpt', 'gpt', 'openai']
  };
  
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      tags.push(tag);
    }
  }
  
  return tags.length > 0 ? tags : ['设计', 'AI'];
}

// 简单翻译函数（关键词替换，实际项目中可以使用翻译 API）
// 注意：这是一个简化的翻译函数，仅处理常见关键词
// 实际生产环境建议使用 Google Translate API 或其他专业翻译服务
function translateToChinese(text) {
  if (!text) return '';
  
  // 简单的关键词翻译映射（常见术语）
  const translations = {
    'AI': 'AI',
    'Artificial Intelligence': '人工智能',
    'Machine Learning': '机器学习',
    'Deep Learning': '深度学习',
    'Design': '设计',
    'System': '系统',
    'Tool': '工具',
    'User Experience': '用户体验',
    'Interface': '界面',
    'Component': '组件',
    'Update': '更新',
    'New': '新',
    'Feature': '功能',
    'Release': '发布',
    'Guide': '指南',
    'Tutorial': '教程',
    'Best Practices': '最佳实践',
    'Case Study': '案例研究',
    'Announcement': '公告',
    'Blog': '博客',
    'Article': '文章',
    'Copilot': 'Copilot',
    'Assistant': '助手',
    'Agent': '代理',
    'Model': '模型',
    'Neural': '神经网络',
    'Generative': '生成式'
  };
  
  // 暂时返回原文，保持标题可读性
  // TODO: 集成专业翻译 API 以实现完整的中文翻译
  return text;
}

// ====================
// 站点抓取器实现
// ====================

/**
 * Material Design 抓取器
 */
async function fetchFromMaterial() {
  try {
    const url = 'https://m3.material.io/blog';
    console.log(`  开始请求: ${url}`);
    const html = await fetch(url);
    console.log(`  响应长度: ${html.length} 字符`);
    
    if (!html || html.length < 100) {
      console.error('  警告: 响应内容过短，可能请求失败');
      return [];
    }
    
    const $ = cheerio.load(html);
    const items = [];
    
    // 方法1：查找所有包含 /blog/ 的链接（包括自定义标签内的）
    $('a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 3) return false; // 收集更多以便筛选
      
      const $elem = $(elem);
      let link = $elem.attr('href');
      
      if (!link) return;
      
      // 如果链接是相对路径，转换为绝对路径
      if (!link.startsWith('http')) {
        link = link.startsWith('/') ? `https://m3.material.io${link}` : `https://m3.material.io/${link}`;
      }
      
      // 跳过不包含 /blog/ 的链接（比如 /blog#main_content）或导航链接
      if (!link.includes('/blog/') || link.endsWith('#main_content') || 
          link === 'https://m3.material.io/blog' || link.includes('/blog#')) {
        return;
      }
      
      // 获取标题 - 文本格式可能是 "日期+标题"，需要提取标题部分
      let title = $elem.text().trim();
      
      // 跳过导航和无关文本
      if (title.includes('Skip') || title.includes('Blog') || title.length < 10) {
        return;
      }
      
      // 尝试从文本中提取标题（去掉日期部分）
      // 格式可能是：May 13, 2025Start building...
      const titleMatch = title.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,\s+\d{4})(.+)/i);
      let dateStr = null;
      if (titleMatch) {
        dateStr = titleMatch[1];
        title = titleMatch[2].trim();
      }
      
      // 如果标题还是太长或包含日期，尝试从其他元素获取
      if (!title || title.length < 5 || title.length > 200) {
        title = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim() ||
                $elem.parent().find('h1, h2, h3, h4').first().text().trim() ||
                title; // 保留原文本作为备选
      }
      
      // 获取摘要 - 可能在兄弟元素或父元素中
      const $parent = $elem.parent();
      let summary = $parent.find('p').first().text().trim() || 
                    $elem.siblings('p').first().text().trim() ||
                    $parent.siblings('p').first().text().trim();
      
      // 如果没有找到日期，尝试从元素属性获取
      if (!dateStr) {
        dateStr = $elem.find('time').first().attr('datetime') || 
                  $parent.find('time').first().attr('datetime') ||
                  $elem.find('time').first().text().trim() ||
                  $parent.find('time').first().text().trim();
      }
      
      if (title && link && title.length > 5 && !title.includes('Skip') && !title.includes('Blog')) {
        items.push({
          title: translateToChinese(title),
          url: link,
          summary: translateToChinese(summary || title.substring(0, 150)),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    console.log(`  找到 ${items.length} 个链接`);
    
    // 如果没找到链接，尝试更宽松的选择器
    if (items.length === 0) {
      console.log(`  尝试更宽松的选择器...`);
      // 尝试查找所有链接
      $('a').each((i, elem) => {
        if (items.length >= 50) return false;
        const $elem = $(elem);
        let link = $elem.attr('href');
        if (!link) return;
        
        if (!link.startsWith('http')) {
          link = link.startsWith('/') ? `https://m3.material.io${link}` : `https://m3.material.io/${link}`;
        }
        
        if (link.includes('/blog/') && !link.endsWith('#main_content') && 
            link !== 'https://m3.material.io/blog' && !link.includes('/blog#')) {
          let title = $elem.text().trim();
          if (title && title.length > 10 && !title.includes('Skip') && !title.includes('Blog')) {
            // 提取标题（去掉日期）
            const titleMatch = title.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,\s+\d{4})(.+)/i);
            if (titleMatch) {
              title = titleMatch[2].trim();
            }
            if (title && title.length > 5) {
              items.push({
                title: translateToChinese(title),
                url: link,
                summary: translateToChinese(title),
                publishedAt: parseDate(titleMatch ? titleMatch[1] : null),
                tags: extractTags(title, '')
              });
            }
          }
        }
      });
      console.log(`  使用宽松选择器找到 ${items.length} 个链接`);
    }
    
    // 去重并筛选（按URL去重，规范化URL）
    const normalizeUrl = (url) => {
      try {
        const urlObj = new URL(url);
        // 移除查询参数和hash，只保留路径
        return urlObj.origin + urlObj.pathname;
      } catch (e) {
        return url;
      }
    };
    
    const uniqueItems = items.filter((item, index, self) => {
      const normalizedUrl = normalizeUrl(item.url);
      return self.findIndex(i => normalizeUrl(i.url) === normalizedUrl) === index;
    });
    
    console.log(`  去重后剩余 ${uniqueItems.length} 条（原始 ${items.length} 条）`);
    
    // 优先过滤 AI 相关内容
    const aiItems = uniqueItems.filter(item => 
      isAIRelated(item.title) || isAIRelated(item.summary)
    );
    
    console.log(`  AI相关: ${aiItems.length} 条`);
    
    // 如果 AI 相关条目不足，补充最近的其他条目
    let resultItems = [...aiItems];
    if (resultItems.length < CONFIG.MAX_ITEMS_PER_SITE) {
      const otherItems = uniqueItems.filter(item => 
        !isAIRelated(item.title) && !isAIRelated(item.summary)
      );
      resultItems = [...aiItems, ...otherItems];
    }
    
    const final = resultItems
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
    
    console.log(`  返回 ${final.length} 条记录`);
    return final;
      
  } catch (error) {
    console.error('Material Design 抓取失败:', error.message);
    console.error('错误堆栈:', error.stack);
    throw error; // 重新抛出错误，让主函数捕获
  }
}

/**
 * Microsoft Design 抓取器
 */
async function fetchFromMicrosoftDesign() {
  try {
    const url = 'https://microsoft.design/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    // 解析文章列表
    $('article, [class*="article"], [class*="post"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const titleElem = $elem.find('h1, h2, h3, h4, [class*="title"], a').first();
      const title = titleElem.text().trim();
      const link = titleElem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://microsoft.design${link}`;
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    // 优先过滤 AI 相关内容
    const aiItems = items.filter(item => 
      isAIRelated(item.title) || isAIRelated(item.summary)
    );
    
    let resultItems = [...aiItems];
    if (resultItems.length < CONFIG.MAX_ITEMS_PER_SITE) {
      const otherItems = items.filter(item => 
        !isAIRelated(item.title) && !isAIRelated(item.summary)
      );
      resultItems = [...aiItems, ...otherItems];
    }
    
    return resultItems
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Microsoft Design 抓取失败:', error.message);
    return [];
  }
}

/**
 * Google Design 抓取器
 */
async function fetchFromGoogleDesign() {
  try {
    const url = 'https://design.google/';
    console.log(`  开始请求: ${url}`);
    const html = await fetch(url);
    console.log(`  响应长度: ${html.length} 字符`);
    
    const $ = cheerio.load(html);
    const items = [];
    
    // 方法1：使用正则表达式直接从HTML中提取 /library/ 链接（更可靠）
    const libraryLinkRegex = /href=["']([^"']*\/library\/[^"']*?)["']/gi;
    const foundLinks = new Set();
    let match;
    
    while ((match = libraryLinkRegex.exec(html)) !== null && foundLinks.size < CONFIG.MAX_ITEMS_PER_SITE * 3) {
      let link = match[1];
      
      // 排除分类和标签链接
      if (link.includes('/category/') || link.includes('/tags/')) {
        continue;
      }
      
      // 排除导航链接
      if (link === '/library/' || link.endsWith('#') || link.includes('#')) {
        continue;
      }
      
      // 转换为绝对路径
      if (!link.startsWith('http')) {
        link = link.startsWith('/') ? `https://design.google${link}` : `https://design.google/${link}`;
      }
      
      foundLinks.add(link);
    }
    
    console.log(`  从HTML中提取到 ${foundLinks.size} 个文章链接`);
    
    // 方法2：使用 cheerio 解析每个链接，获取标题和摘要
    Array.from(foundLinks).forEach(link => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 3) return;
      
      const relPath = link.replace('https://design.google', '');
      
      // 尝试多种方式查找链接元素
      let $elem = $(`a[href="${relPath}"]`).first();
      if ($elem.length === 0) {
        $elem = $(`a[href="${link}"]`).first();
      }
      if ($elem.length === 0) {
        // 使用包含路径的最后一部分来查找
        const pathPart = relPath.split('/').pop();
        $elem = $(`a[href*="${pathPart}"]`).first();
      }
      
      let title = '';
      let summary = '';
      let category = '';
      
      if ($elem.length > 0) {
        // 从链接元素中获取标题
        title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
        if (!title || title.length < 5) {
          const $parent = $elem.closest('article, [class*="card"], div, section, a');
          title = $parent.find('h1, h2, h3, h4').first().text().trim() ||
                  $elem.siblings('h1, h2, h3, h4').first().text().trim() ||
                  $elem.text().trim();
        }
        
        // 获取摘要
        const $parent = $elem.closest('article, [class*="card"], div, section');
        summary = $parent.find('p').first().text().trim();
        if (!summary) {
          summary = $elem.siblings('p').first().text().trim();
        }
        
        // 获取分类
        category = $parent.find('a[href*="/category/"], a[href*="/tags/"]').first().text().trim() || '';
      }
      
      // 如果还是找不到标题，从链接路径生成标题
      if (!title || title.length < 5) {
        const pathParts = relPath.split('/').pop().split('-');
        title = pathParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
      }
      
      // 跳过导航和无关文本
      if (title.includes('Skip') || title.includes('View') || title.length < 5) {
        return;
      }
      
      items.push({
        title: translateToChinese(title),
        url: link,
        summary: translateToChinese(summary || title.substring(0, 150)),
        publishedAt: null,
        tags: extractTags(title, summary + ' ' + category)
      });
    });
    
    console.log(`  解析后得到 ${items.length} 个文章项`);
    
    // 如果还是没找到，使用 cheerio 选择器作为备用
    if (items.length === 0) {
      console.log(`  尝试使用 cheerio 选择器...`);
      $('a[href*="/library/"]').each((i, elem) => {
        if (items.length >= 100) return false;
        const $elem = $(elem);
        let link = $elem.attr('href');
        if (!link) return;
        
        if (link.includes('/category/') || link.includes('/tags/')) {
          return;
        }
        
        if (!link.startsWith('http')) {
          link = link.startsWith('/') ? `https://design.google${link}` : `https://design.google/${link}`;
        }
        
        let title = $elem.text().trim();
        if (title && title.length > 5 && !title.includes('Skip') && !title.includes('View')) {
          items.push({
            title: translateToChinese(title),
            url: link,
            summary: translateToChinese(title),
            publishedAt: null,
            tags: extractTags(title, '')
          });
        }
      });
      console.log(`  使用 cheerio 选择器找到 ${items.length} 个链接`);
    }
    
    // 去重（按URL去重，规范化URL）
    const normalizeUrl = (url) => {
      try {
        const urlObj = new URL(url);
        // 移除查询参数和hash，只保留路径
        return urlObj.origin + urlObj.pathname;
      } catch (e) {
        return url;
      }
    };
    
    const uniqueItems = items.filter((item, index, self) => {
      const normalizedUrl = normalizeUrl(item.url);
      return self.findIndex(i => normalizeUrl(i.url) === normalizedUrl) === index;
    });
    
    console.log(`  去重后剩余 ${uniqueItems.length} 条（原始 ${items.length} 条）`);
    
    // 优先过滤 AI 相关内容
    const aiItems = uniqueItems.filter(item => 
      isAIRelated(item.title) || isAIRelated(item.summary)
    );
    
    console.log(`  AI相关: ${aiItems.length} 条`);
    
    let resultItems = [...aiItems];
    if (resultItems.length < CONFIG.MAX_ITEMS_PER_SITE) {
      const otherItems = uniqueItems.filter(item => 
        !isAIRelated(item.title) && !isAIRelated(item.summary)
      );
      resultItems = [...aiItems, ...otherItems];
    }
    
    // 确保返回最多10条
    const final = resultItems.slice(0, CONFIG.MAX_ITEMS_PER_SITE);
    console.log(`  返回 ${final.length} 条记录`);
    return final;
      
  } catch (error) {
    console.error('Google Design 抓取失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return [];
  }
}

/**
 * Figma 抓取器
 */
async function fetchFromFigma() {
  try {
    const url = 'https://www.figma.com/blog/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    // 解析博客文章
    $('article, [class*="post"], [class*="article"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const titleElem = $elem.find('h1, h2, h3, h4, [class*="title"]').first();
      const title = titleElem.text().trim() || $elem.text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 10) {
        const fullUrl = link.startsWith('http') ? link : `https://www.figma.com${link}`;
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    // 优先过滤 AI 相关内容
    const aiItems = items.filter(item => 
      isAIRelated(item.title) || isAIRelated(item.summary)
    );
    
    let resultItems = [...aiItems];
    if (resultItems.length < CONFIG.MAX_ITEMS_PER_SITE) {
      const otherItems = items.filter(item => 
        !isAIRelated(item.title) && !isAIRelated(item.summary)
      );
      resultItems = [...aiItems, ...otherItems];
    }
    
    return resultItems
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Figma 抓取失败:', error.message);
    return [];
  }
}

/**
 * Anthropic 抓取器
 */
async function fetchFromAnthropic() {
  try {
    const url = 'https://www.anthropic.com/news';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="post"], [class*="article"], a[href*="/news/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://www.anthropic.com${link}`;
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Anthropic 抓取失败:', error.message);
    return [];
  }
}

/**
 * OpenAI 抓取器
 */
async function fetchFromOpenAI() {
  try {
    // 使用中文新闻页面
    const url = 'https://openai.com/zh-Hans-CN/news/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    // 解析新闻卡片
    $('article, a[href*="/index/"], a[href*="/zh-Hans-CN/index/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      // 标题可能在链接文本中，或者在内部元素中
      let title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      if (!title) {
        title = $elem.text().trim().split('\n')[0]; // 取第一行文本
      }
      
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="description"]').first().text().trim();
      
      // 提取日期
      let dateStr = $elem.find('time[datetime]').first().attr('datetime') || 
                    $elem.find('time').first().text().trim() ||
                    $elem.find('[class*="date"]').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://openai.com${link}` : `https://openai.com/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => {
        // 去重：基于URL
        const indexInSelf = self.findIndex(i => i.url === item.url);
        return indexInSelf === index && item.title.length > 5;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('OpenAI 抓取失败:', error.message);
    return [];
  }
}

/**
 * Meta AI 抓取器
 */
async function fetchFromMetaAI() {
  try {
    // 使用正确的URL（不带尾部斜杠可能更好）
    const url = 'https://ai.meta.com/blog/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    // 解析博客文章链接 - 根据实际HTML结构
    $('a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const $parent = $elem.closest('article, [class*="card"], [class*="post"]');
      
      // 标题可能在链接内，或者在父元素中
      let title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      if (!title) {
        title = $parent.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      }
      if (!title || title.length < 5) {
        // 如果还是找不到，尝试从链接文本中提取
        const linkText = $elem.text().trim();
        if (linkText.length > 10 && !linkText.toLowerCase().includes('read')) {
          title = linkText;
        }
      }
      
      const link = $elem.attr('href');
      
      // 摘要可能在父元素或兄弟元素中
      let summary = $parent.find('p, [class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
      if (!summary && $parent.length === 0) {
        summary = $elem.siblings('p').first().text().trim();
      }
      
      // 日期可能在父元素或链接附近
      let dateStr = $parent.find('time[datetime]').first().attr('datetime') || 
                    $parent.find('time').first().text().trim() ||
                    $elem.parent().find('time, [class*="date"]').first().text().trim();
      
      if (title && link && title.length > 5 && link.includes('/blog/')) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://ai.meta.com${link}` : `https://ai.meta.com/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => {
        // 去重：基于URL和标题
        const indexInSelf = self.findIndex(i => i.url === item.url || (i.title === item.title && i.title.length > 10));
        return indexInSelf === index && item.title.length > 5;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Meta AI 抓取失败:', error.message);
    return [];
  }
}

/**
 * Google AI 抓取器
 */
async function fetchFromGoogleAI() {
  try {
    const url = 'https://ai.google/products/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="post"], [class*="article"], a[href*="/products/"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"]').first().text().trim();
      
      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://ai.google.com${link}`;
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: null,
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items.slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Google AI 抓取失败:', error.message);
    return [];
  }
}

/**
 * GitHub 抓取器
 */
async function fetchFromGitHub() {
  try {
    // 使用主页，然后过滤 AI 相关内容
    const url = 'https://github.blog/';
    const html = await fetch(url); // fetch 函数现在会自动处理重定向
    const $ = cheerio.load(html);
    const items = [];
    
    // 解析文章 - 根据实际HTML结构
    $('article, a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 3) return false; // 收集更多以便筛选
      
      const $elem = $(elem);
      const $article = $elem.is('article') ? $elem : $elem.closest('article');
      
      // 标题可能在 h2 或链接中
      let title = $article.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      if (!title) {
        title = $elem.find('h1, h2, h3, h4').first().text().trim();
      }
      
      // 链接可能在文章内的链接或元素本身的href
      let link = $article.find('a[href*="/blog/"]').first().attr('href') || 
                 $elem.attr('href') || 
                 $elem.find('a[href*="/blog/"]').first().attr('href');
      
      // 摘要
      const summary = $article.find('p').first().text().trim();
      
      // 日期
      let dateStr = $article.find('time[datetime]').first().attr('datetime') || 
                    $article.find('time').first().text().trim();
      
      if (title && link && title.length > 5 && link.includes('/blog/')) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://github.blog${link}` : `https://github.blog/${link}`;
        }
        
        // 只保留 AI 相关的内容
        if (isAIRelated(title + ' ' + summary) || link.includes('copilot') || link.includes('ai-and-ml')) {
          items.push({
            title: translateToChinese(title),
            url: fullUrl,
            summary: translateToChinese(summary || title),
            publishedAt: parseDate(dateStr),
            tags: extractTags(title, summary)
          });
        }
      }
    });
    
    return items
      .filter((item, index, self) => {
        // 去重：基于URL
        const indexInSelf = self.findIndex(i => i.url === item.url);
        return indexInSelf === index && item.title.length > 5;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('GitHub 抓取失败:', error.message);
    return [];
  }
}

/**
 * AWS 抓取器
 */
async function fetchFromAWS() {
  try {
    // 使用英文URL，避免重定向问题
    const url = 'https://aws.amazon.com/blogs/machine-learning/';
    const html = await fetch(url); // fetch 函数现在会自动处理重定向
    const $ = cheerio.load(html);
    const items = [];
    
    // 尝试多种选择器
    $('article, [class*="post"], [class*="article"], [class*="blog"], a[href*="/machine-learning/"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time, [datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://aws.amazon.com${link}` : `https://aws.amazon.com/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index) // 去重
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('AWS 抓取失败:', error.message);
    return [];
  }
}

/**
 * Adobe 抓取器
 */
async function fetchFromAdobe() {
  try {
    // 使用博客页面，更容易抓取
    const url = 'https://blog.adobe.com/en/topics/artificial-intelligence';
    const html = await fetch(url, {
      timeout: 90000 // 增加超时时间到90秒
    });
    const $ = cheerio.load(html);
    const items = [];
    
    // 尝试多种选择器
    $('article, [class*="post"], [class*="article"], [class*="blog"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time, [datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://blog.adobe.com${link}` : `https://blog.adobe.com/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index) // 去重
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Adobe 抓取失败:', error.message);
    return [];
  }
}

/**
 * Mapbox 抓取器
 */
async function fetchFromMapbox() {
  try {
    const url = 'https://www.mapbox.com/blog';
    const html = await fetch(url); // fetch 函数现在会自动处理重定向
    const $ = cheerio.load(html);
    const items = [];
    
    // 尝试多种选择器
    $('article, [class*="post"], [class*="article"], [class*="blog"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time, [datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://www.mapbox.com${link}` : `https://www.mapbox.com/${link}`;
        }
        // 如果包含 AI 关键词，或者允许所有内容
        if (isAIRelated(title + ' ' + summary) || items.length < 5) {
          items.push({
            title: translateToChinese(title),
            url: fullUrl,
            summary: translateToChinese(summary || title),
            publishedAt: parseDate(dateStr),
            tags: extractTags(title, summary)
          });
        }
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index) // 去重
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Mapbox 抓取失败:', error.message);
    return [];
  }
}

/**
 * AIBase 抓取器
 */
async function fetchFromAIBase() {
  try {
    const url = 'https://www.aibase.com/zh/news';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="article"], [class*="post"], [class*="news"], a[href*="/news/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('[class*="date"], time').first().text().trim() || 
                      $elem.find('[datetime]').first().attr('datetime');
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://www.aibase.com${link}` : `https://www.aibase.com/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index)
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('AIBase 抓取失败:', error.message);
    return [];
  }
}

/**
 * 机器之心 抓取器
 */
async function fetchFromJiqizhixin() {
  try {
    const url = 'https://www.jiqizhixin.com/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    const seenUrls = new Set();
    
    // 方法1：优先识别首页文章标题 - 查找标题元素，然后找附近的链接
    $('h1, h2, h3, h4, [class*="title"], [class*="headline"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.text().trim();
      
      if (!title || title.length < 10) return;
      
      // 跳过明显的非文章标题
      if (title.includes('机器之心') || 
          title.includes('PRO') && title.includes('会员') ||
          title.includes('AI Shortlist') ||
          title.includes('SOTA！模型')) {
        return;
      }
      
      // 查找标题附近的链接
      let link = null;
      let summary = '';
      
      // 方法1.1：标题本身是链接
      const $titleLink = $elem.find('a[href]').first();
      if ($titleLink.length > 0) {
        link = $titleLink.attr('href');
      } else {
        // 方法1.2：在父元素中查找链接
        const $parent = $elem.closest('div, article, section, li, a');
        const $link = $parent.is('a') ? $parent : $parent.find('a[href]').first();
        if ($link.length > 0) {
          link = $link.attr('href');
        }
      }
      
      if (!link) return;
      
      // 跳过明显的非文章链接
      if (link.includes('#') || 
          link.includes('javascript:') || 
          link === '/' ||
          link.includes('/inbox') ||
          link.includes('/m/') ||
          link.includes('/ai_shortlist') ||
          link.includes('aihaohaoyong.com') ||
          link.includes('/short_urls')) {
        return;
      }
      
      // 构建完整 URL
      let fullUrl = link;
      if (!link.startsWith('http')) {
        if (link.startsWith('//')) {
          fullUrl = 'https:' + link;
        } else if (link.startsWith('/')) {
          fullUrl = `https://www.jiqizhixin.com${link}`;
        } else {
          fullUrl = `https://www.jiqizhixin.com/${link}`;
        }
      }
      
      // 规范化 URL
      try {
        const urlObj = new URL(fullUrl);
        const normalizedUrl = urlObj.origin + urlObj.pathname;
        if (seenUrls.has(normalizedUrl)) return;
        seenUrls.add(normalizedUrl);
        fullUrl = normalizedUrl;
      } catch (e) {
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);
      }
      
      // 获取摘要
      const $parent = $elem.closest('div, article, section, li');
      summary = $parent.find('p, [class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
      if (!summary) {
        // 从父元素文本中提取摘要（排除标题）
        const parentText = $parent.text().trim();
        const titleIndex = parentText.indexOf(title);
        if (titleIndex >= 0) {
          summary = parentText.substring(titleIndex + title.length, titleIndex + title.length + 150).trim();
        }
      }
      
      if (title && title.length > 10) {
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title.substring(0, 150)),
          publishedAt: null,
          tags: extractTags(title, summary)
        });
      }
    });
    
    // 方法2：如果还不够，使用 cheerio 查找所有链接（作为补充）
    if (items.length < CONFIG.MAX_ITEMS_PER_SITE) {
      $('a[href]').each((i, elem) => {
        if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 3) return false;
        
        const $elem = $(elem);
        let link = $elem.attr('href');
        if (!link) return;
        
        // 获取链接文本
        let title = $elem.text().trim();
        
        // 跳过明显的非文章链接
        if (link.includes('#') || 
            link.includes('javascript:') || 
            link === '/' ||
            link.includes('/inbox') ||
            link.includes('/m/') ||
            link.includes('/ai_shortlist') ||
            link.includes('aihaohaoyong.com') ||
            link.includes('/short_urls')) {
          return;
        }
        
        // 查找包含文章路径的链接（包括 pro.jiqizhixin.com/reference/）
        const isArticleLink = link.includes('/reference/') || 
                             link.includes('/articles/') || 
                             link.includes('/news/') ||
                             link.match(/\/\d{4}\/\d{2}\/\d{2}\//) ||
                             (link.includes('jiqizhixin.com') && !link.includes('/inbox') && !link.includes('/m/'));
        
        if (!isArticleLink) return;
        
        // 构建完整 URL
        let fullUrl = link;
      if (!link.startsWith('http')) {
        if (link.startsWith('//')) {
          fullUrl = 'https:' + link;
        } else if (link.startsWith('/')) {
          fullUrl = `https://www.jiqizhixin.com${link}`;
        } else {
          fullUrl = `https://www.jiqizhixin.com/${link}`;
        }
      }
      
        // 规范化 URL（移除查询参数和 hash）
        try {
          const urlObj = new URL(fullUrl);
          const normalizedUrl = urlObj.origin + urlObj.pathname;
          if (seenUrls.has(normalizedUrl)) return;
          seenUrls.add(normalizedUrl);
          fullUrl = normalizedUrl;
        } catch (e) {
          if (seenUrls.has(fullUrl)) return;
          seenUrls.add(fullUrl);
        }
        
        // 如果链接文本太短，尝试从父元素或兄弟元素获取标题
        if (!title || title.length < 5) {
          const $parent = $elem.closest('div, article, section, li');
          title = $parent.find('h1, h2, h3, h4, [class*="title"], [class*="headline"]').first().text().trim() ||
                  $elem.siblings('h1, h2, h3, h4, [class*="title"]').first().text().trim();
        }
        
        // 如果还是找不到，尝试从附近的文本节点获取
        if (!title || title.length < 5) {
          const $parent = $elem.parent();
          title = $parent.text().trim().split('\n')[0].substring(0, 100);
        }
        
        // 如果仍然找不到，从 URL 生成标题
        if (!title || title.length < 5) {
          const urlParts = fullUrl.split('/').filter(p => p && !p.includes('.'));
          const lastPart = urlParts[urlParts.length - 1] || '';
          // 如果是 UUID，跳过（因为这些通常是 PRO 会员内容）
          if (lastPart.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return; // 跳过 UUID 链接（通常是 PRO 内容）
          }
          title = lastPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        // 获取摘要
        const $parent = $elem.closest('div, article, section');
        let summary = $parent.find('p, [class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
        if (!summary) {
          summary = $parent.text().trim().substring(title.length, title.length + 150);
        }
        
        // 过滤掉明显的非文章内容（但允许PRO链接，因为首页主要是这些）
        if (title && 
            title.length > 5 && 
            !title.includes('Skip') &&
            !title.includes('AI Shortlist') &&
            !title.includes('SOTA！模型') &&
            !title.includes('通讯会员') &&
            !title.includes('PRO通讯会员') &&
            title !== '机器之心文章') {
          items.push({
            title: translateToChinese(title),
            url: fullUrl,
            summary: translateToChinese(summary || title.substring(0, 150)),
            publishedAt: null,
            tags: extractTags(title, summary)
          });
        }
      }
    });
    
    // 方法2：从 HTML 文本中直接提取所有包含 reference/articles/news 的 URL（作为补充）
    const urlPatterns = [
      /href=["']([^"']*(?:reference|articles|news)[^"']*)["']/gi,
      /https?:\/\/[^\s"'<>]+(?:pro\.)?jiqizhixin\.com\/(?:reference|articles|news)\/[^\s"'<>]+/gi
    ];
    
    urlPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && items.length < CONFIG.MAX_ITEMS_PER_SITE * 3) {
        let link = match[1] || match[0];
        if (!link || link.includes('#') || link.includes('javascript:')) continue;
        
        // 清理链接（移除 HTML 实体）
        link = link.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
        
        let fullUrl = link;
        if (!link.startsWith('http')) {
          if (link.startsWith('//')) {
            fullUrl = 'https:' + link;
          } else if (link.startsWith('/')) {
            fullUrl = `https://www.jiqizhixin.com${link}`;
          } else {
            fullUrl = `https://www.jiqizhixin.com/${link}`;
          }
        }
        
        // 规范化 URL
        try {
          const urlObj = new URL(fullUrl);
          const normalizedUrl = urlObj.origin + urlObj.pathname;
          if (seenUrls.has(normalizedUrl)) continue;
          seenUrls.add(normalizedUrl);
          fullUrl = normalizedUrl;
        } catch (e) {
          if (seenUrls.has(fullUrl)) continue;
          seenUrls.add(fullUrl);
        }
        
        // 从 HTML 中查找标题（在链接附近）
        const linkIndex = html.indexOf(match[0]);
        const context = html.substring(Math.max(0, linkIndex - 1000), Math.min(html.length, linkIndex + 1000));
        
        // 尝试多种方式提取标题
        let title = null;
        const titlePatterns = [
          />([^<]{10,100})</g, // 查找链接附近的文本
          /title=["']([^"']+)["']/i,
          /data-title=["']([^"']+)["']/i
        ];
        
        for (const titlePattern of titlePatterns) {
          const matches = context.match(titlePattern);
          if (matches && matches[1] && matches[1].trim().length > 5 && matches[1].trim().length < 200) {
            title = matches[1].trim();
            // 过滤掉 HTML 标签和特殊字符
            title = title.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, '').trim();
            if (title.length > 5 && !title.includes('PRO') && !title.includes('会员')) {
              break;
            }
          }
        }
        
        // 如果还是找不到，跳过（避免使用默认标题）
        if (!title || title.length < 5 || title.includes('PRO') || title.includes('会员')) {
          continue;
        }
        
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(title.substring(0, 150)),
          publishedAt: null,
          tags: extractTags(title, '')
        });
      }
      pattern.lastIndex = 0; // 重置正则
    });
    
    // 如果还是不够，尝试访问其他页面或使用备用方法
    if (items.length < CONFIG.MAX_ITEMS_PER_SITE) {
      // 方法3：尝试从script标签中的JSON数据提取（如果存在）
      const scripts = $('script').toArray();
      for (const script of scripts) {
        if (items.length >= CONFIG.MAX_ITEMS_PER_SITE) break;
        
        const scriptContent = $(script).html() || '';
        // 查找可能的JSON数据中的文章列表
        if (scriptContent.includes('articles') || scriptContent.includes('news') || scriptContent.includes('list')) {
          // 尝试提取URL模式
          const urlMatches = scriptContent.match(/https?:\/\/[^\s"'<>]+(?:reference|articles|news)[^\s"'<>]+/gi);
          if (urlMatches) {
            for (const urlMatch of urlMatches) {
              if (items.length >= CONFIG.MAX_ITEMS_PER_SITE) break;
              
              let fullUrl = urlMatch.replace(/['"]/g, '').replace(/&amp;/g, '&');
              try {
                const urlObj = new URL(fullUrl);
                const normalizedUrl = urlObj.origin + urlObj.pathname;
                if (seenUrls.has(normalizedUrl)) continue;
                seenUrls.add(normalizedUrl);
                fullUrl = normalizedUrl;
                
                // 尝试从script内容中查找对应的标题
                const urlIndex = scriptContent.indexOf(urlMatch);
                const context = scriptContent.substring(Math.max(0, urlIndex - 500), Math.min(scriptContent.length, urlIndex + 500));
                const titleMatch = context.match(/"title"\s*:\s*"([^"]+)"/i) || 
                                  context.match(/'title'\s*:\s*'([^']+)'/i) ||
                                  context.match(/title:\s*"([^"]+)"/i);
                
                let title = titleMatch ? titleMatch[1].trim() : null;
                if (!title || title.length < 5) {
                  // 尝试从URL生成标题
                  const urlParts = fullUrl.split('/').filter(p => p);
                  const lastPart = urlParts[urlParts.length - 1];
                  if (lastPart && !lastPart.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                    title = lastPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  } else {
                    continue; // 跳过UUID链接
                  }
                }
                
                if (title && title.length > 5 && 
                    !title.includes('PRO通讯会员') && 
                    !title.includes('通讯会员') &&
                    !title.includes('AI Shortlist')) {
                  items.push({
                    title: translateToChinese(title),
                    url: fullUrl,
                    summary: translateToChinese(title.substring(0, 150)),
                    publishedAt: null,
                    tags: extractTags(title, '')
                  });
                }
              } catch (e) {
                // URL解析失败，跳过
                continue;
              }
            }
          }
        }
      }
    }
    
    return items
      .filter((item, index, self) => {
        const indexInSelf = self.findIndex(i => i.url === item.url);
        return indexInSelf === index && item.title.length > 5;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('机器之心 抓取失败:', error.message);
    return [];
  }
}

/**
 * 量子位 抓取器
 */
async function fetchFromQbitai() {
  try {
    const url = 'https://www.qbitai.com/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    const seenUrls = new Set();
    
    // 方法1：优先识别首页文章标题 - 查找标题元素，然后找附近的链接
    $('h1, h2, h3, h4, [class*="title"], [class*="headline"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.text().trim();
      
      if (!title || title.length < 10) return;
      
      // 查找标题附近的链接
      let link = null;
      let summary = '';
      
      // 方法1.1：标题本身是链接
      const $titleLink = $elem.find('a[href]').first();
      if ($titleLink.length > 0) {
        link = $titleLink.attr('href');
      } else {
        // 方法1.2：在父元素中查找链接
        const $parent = $elem.closest('div, article, section, li, a');
        const $link = $parent.is('a') ? $parent : $parent.find('a[href]').first();
        if ($link.length > 0) {
          link = $link.attr('href');
        }
      }
      
      if (!link) return;
      
      // 构建完整 URL
      let fullUrl = link;
      if (!link.startsWith('http')) {
        fullUrl = link.startsWith('/') ? `https://www.qbitai.com${link}` : `https://www.qbitai.com/${link}`;
      }
      
      // 规范化 URL
      try {
        const urlObj = new URL(fullUrl);
        const normalizedUrl = urlObj.origin + urlObj.pathname;
        if (seenUrls.has(normalizedUrl)) return;
        seenUrls.add(normalizedUrl);
        fullUrl = normalizedUrl;
      } catch (e) {
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);
      }
      
      // 获取摘要
      const $parent = $elem.closest('div, article, section, li');
      summary = $parent.find('p, [class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
      if (!summary) {
        // 从父元素文本中提取摘要（排除标题）
        const parentText = $parent.text().trim();
        const titleIndex = parentText.indexOf(title);
        if (titleIndex >= 0) {
          summary = parentText.substring(titleIndex + title.length, titleIndex + title.length + 150).trim();
        }
      }
      
      // 获取日期
      const dateStr = $parent.find('[class*="date"], time[datetime]').first().attr('datetime') || 
                      $parent.find('[class*="date"], time').first().text().trim();
      
      if (title && title.length > 10 && !title.includes('量子位') && !title.includes('QbitAI')) {
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title.substring(0, 150)),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    // 方法2：如果还不够，使用传统方法查找文章链接
    if (items.length < CONFIG.MAX_ITEMS_PER_SITE) {
      $('article, [class*="article"], [class*="post"], [class*="news"], a[href*="/202"]').each((i, elem) => {
        if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
        
        const $elem = $(elem);
        const link = $elem.attr('href') || $elem.find('a').first().attr('href');
        if (!link || !link.includes('/202')) return;
        
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://www.qbitai.com${link}` : `https://www.qbitai.com/${link}`;
        }
        
        try {
          const urlObj = new URL(fullUrl);
          const normalizedUrl = urlObj.origin + urlObj.pathname;
          if (seenUrls.has(normalizedUrl)) return;
          seenUrls.add(normalizedUrl);
          fullUrl = normalizedUrl;
        } catch (e) {
          if (seenUrls.has(fullUrl)) return;
          seenUrls.add(fullUrl);
        }
        
        const title = $elem.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
        const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
        const dateStr = $elem.find('[class*="date"], time').first().text().trim() || 
                        $elem.find('[datetime]').first().attr('datetime');
        
        if (title && title.length > 10) {
          items.push({
            title: translateToChinese(title),
            url: fullUrl,
            summary: translateToChinese(summary || title),
            publishedAt: parseDate(dateStr),
            tags: extractTags(title, summary)
          });
        }
      });
    }
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index)
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('量子位 抓取失败:', error.message);
    return [];
  }
}

/**
 * TechCrunch AI 抓取器
 */
async function fetchFromTechCrunch() {
  try {
    const url = 'https://techcrunch.com/category/artificial-intelligence/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    const seenUrls = new Set();
    
    // 方法1：直接查找包含 /202 的文章链接（更可靠）
    $('a[href*="/202"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      let link = $elem.attr('href');
      if (!link || !link.includes('/202')) return;
      
      // 规范化 URL（移除查询参数和 hash）
      let fullUrl = link;
      if (!link.startsWith('http')) {
        fullUrl = link.startsWith('/') ? `https://techcrunch.com${link}` : `https://techcrunch.com/${link}`;
      }
      
      // 移除查询参数和 hash 用于去重
      try {
        const urlObj = new URL(fullUrl);
        const normalizedUrl = urlObj.origin + urlObj.pathname;
        if (seenUrls.has(normalizedUrl)) return;
        seenUrls.add(normalizedUrl);
        fullUrl = normalizedUrl;
      } catch (e) {
        // 如果 URL 解析失败，使用原始 URL
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);
      }
      
      // 获取标题 - 优先从链接文本或父元素获取
      let title = $elem.text().trim();
      if (!title || title.length < 5) {
        const $parent = $elem.closest('article, div, section');
        title = $parent.find('h1, h2, h3, h4, [class*="title"], [class*="headline"], [class*="post-title"]').first().text().trim() ||
                $elem.find('h1, h2, h3, h4').first().text().trim();
      }
      
      // 获取摘要
      const $parent = $elem.closest('article, div, section');
      let summary = $parent.find('p, [class*="summary"], [class*="excerpt"], [class*="deck"]').first().text().trim();
      if (!summary) {
        summary = $elem.siblings('p').first().text().trim();
      }
      
      // 获取日期
      const dateStr = $parent.find('time[datetime]').first().attr('datetime') || 
                      $elem.closest('article, div').find('time[datetime]').first().attr('datetime') ||
                      $parent.find('[class*="date"], time').first().text().trim();
      
      if (title && title.length > 5 && !title.includes('Skip') && !title.includes('Read more')) {
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title.substring(0, 150)),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    // 方法2：如果方法1找到的太少，尝试从 article 元素提取
    if (items.length < CONFIG.MAX_ITEMS_PER_SITE) {
      $('article').each((i, elem) => {
        if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
        
        const $elem = $(elem);
        const $link = $elem.find('a[href*="/202"]').first();
        if ($link.length === 0) return;
        
        let link = $link.attr('href');
        if (!link) return;
        
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://techcrunch.com${link}` : `https://techcrunch.com/${link}`;
        }
        
        try {
          const urlObj = new URL(fullUrl);
          const normalizedUrl = urlObj.origin + urlObj.pathname;
          if (seenUrls.has(normalizedUrl)) return;
          seenUrls.add(normalizedUrl);
          fullUrl = normalizedUrl;
        } catch (e) {
          if (seenUrls.has(fullUrl)) return;
          seenUrls.add(fullUrl);
        }
        
        const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="headline"]').first().text().trim();
        const summary = $elem.find('p, [class*="summary"], [class*="excerpt"], [class*="deck"]').first().text().trim();
        const dateStr = $elem.find('time[datetime]').first().attr('datetime') || 
                        $elem.find('[class*="date"], time').first().text().trim();
        
        if (title && title.length > 5) {
          items.push({
            title: translateToChinese(title),
            url: fullUrl,
            summary: translateToChinese(summary || title.substring(0, 150)),
            publishedAt: parseDate(dateStr),
            tags: extractTags(title, summary)
          });
        }
      });
    }
    
    return items
      .filter((item, index, self) => {
        // 再次去重（基于 URL）
        const indexInSelf = self.findIndex(i => i.url === item.url);
        return indexInSelf === index;
      })
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('TechCrunch 抓取失败:', error.message);
    return [];
  }
}

/**
 * Google DeepMind 抓取器
 */
async function fetchFromGoogleDeepMind() {
  try {
    const url = 'https://blog.google/innovation-and-ai/models-and-research/google-deepmind/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="article"], [class*="post"], [class*="story"], a[href*="/innovation-and-ai/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="headline"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('time[datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5 && link.includes('/innovation-and-ai/')) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://blog.google${link}` : `https://blog.google/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index)
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Google DeepMind 抓取失败:', error.message);
    return [];
  }
}

/**
 * Google Research 抓取器
 */
async function fetchFromGoogleResearch() {
  try {
    const url = 'https://research.google/blog/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="article"], [class*="post"], [class*="blog"], a[href*="/blog/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('time[datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://research.google${link}` : `https://research.google/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index)
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('Google Research 抓取失败:', error.message);
    return [];
  }
}

/**
 * The Rundown 抓取器
 */
async function fetchFromRundown() {
  try {
    const url = 'https://www.therundown.ai/';
    const html = await fetch(url);
    const $ = cheerio.load(html);
    const items = [];
    
    $('article, [class*="article"], [class*="post"], [class*="news"], a[href*="/news/"], a[href*="/posts/"]').each((i, elem) => {
      if (items.length >= CONFIG.MAX_ITEMS_PER_SITE * 2) return false;
      
      const $elem = $(elem);
      const title = $elem.find('h1, h2, h3, h4, [class*="title"], [class*="headline"]').first().text().trim();
      const link = $elem.attr('href') || $elem.find('a').first().attr('href');
      const summary = $elem.find('p, [class*="summary"], [class*="excerpt"]').first().text().trim();
      const dateStr = $elem.find('time[datetime]').first().attr('datetime') || 
                      $elem.find('[class*="date"], time').first().text().trim();
      
      if (title && link && title.length > 5) {
        let fullUrl = link;
        if (!link.startsWith('http')) {
          fullUrl = link.startsWith('/') ? `https://www.therundown.ai${link}` : `https://www.therundown.ai/${link}`;
        }
        items.push({
          title: translateToChinese(title),
          url: fullUrl,
          summary: translateToChinese(summary || title),
          publishedAt: parseDate(dateStr),
          tags: extractTags(title, summary)
        });
      }
    });
    
    return items
      .filter((item, index, self) => self.findIndex(i => i.url === item.url) === index)
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt) : new Date(0);
        const dateB = b.publishedAt ? new Date(b.publishedAt) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, CONFIG.MAX_ITEMS_PER_SITE);
      
  } catch (error) {
    console.error('The Rundown 抓取失败:', error.message);
    return [];
  }
}

// ====================
// 数据处理
// ====================

/**
 * 将抓取的新闻项转换为标准格式
 */
function normalizeNewsItem(item, source, sourceName, index) {
  return {
    id: `${source}-${String(index + 1).padStart(3, '0')}`,
    title: item.title || '',
    url: item.url || '',
    thumbnail: item.thumbnail || '',
    summary: item.summary || '',
    tags: item.tags || [],
    publishedAt: item.publishedAt || new Date().toISOString(),
    publishedAtRelative: getRelativeTime(item.publishedAt)
  };
}

/**
 * 包装站点数据
 */
function wrapSiteSource(source, sourceName, sourceUrl, items) {
  const now = new Date();
  return {
    source,
    sourceName,
    sourceUrl,
    updatedAt: now.toISOString(),
    updatedAtRelative: '刚刚',
    items: items.map((item, index) => 
      normalizeNewsItem(item, source, sourceName, index)
    )
  };
}

// ====================
// 主函数
// ====================

async function main() {
  console.log('开始抓取 AI 设计资讯...\n');

  const results = {
    date: formatDate(),
    sites: []
  };

  // 抓取各个站点
  const siteConfigs = [
    {
      source: 'microsoft',
      sourceName: 'Microsoft Design',
      sourceUrl: 'https://microsoft.design/',
      fetcher: fetchFromMicrosoftDesign
    },
    {
      source: 'google',
      sourceName: 'Google Design',
      sourceUrl: 'https://design.google/',
      fetcher: fetchFromGoogleDesign
    },
    {
      source: 'figma',
      sourceName: 'Figma',
      sourceUrl: 'https://www.figma.com',
      fetcher: fetchFromFigma
    },
    {
      source: 'anthropic',
      sourceName: 'Anthropic',
      sourceUrl: 'https://www.anthropic.com',
      fetcher: fetchFromAnthropic
    },
    {
      source: 'openai',
      sourceName: 'OpenAI',
      sourceUrl: 'https://openai.com/zh-Hans-CN/news/',
      fetcher: fetchFromOpenAI
    },
    {
      source: 'googleai',
      sourceName: 'Google AI',
      sourceUrl: 'https://ai.google/products/',
      fetcher: fetchFromGoogleAI
    },
    {
      source: 'aws',
      sourceName: 'AWS',
      sourceUrl: 'https://aws.amazon.com/cn/machine-learning/',
      fetcher: fetchFromAWS
    },
    {
      source: 'aibase',
      sourceName: 'AIBase',
      sourceUrl: 'https://www.aibase.com/zh/news',
      fetcher: fetchFromAIBase
    },
    {
      source: 'jiqizhixin',
      sourceName: '机器之心',
      sourceUrl: 'https://www.jiqizhixin.com/',
      fetcher: fetchFromJiqizhixin
    },
    {
      source: 'qbitai',
      sourceName: '量子位',
      sourceUrl: 'https://www.qbitai.com/',
      fetcher: fetchFromQbitai
    },
    {
      source: 'techcrunch',
      sourceName: 'TechCrunch AI',
      sourceUrl: 'https://techcrunch.com/category/artificial-intelligence/',
      fetcher: fetchFromTechCrunch
    },
    {
      source: 'googledeepmind',
      sourceName: 'Google DeepMind',
      sourceUrl: 'https://blog.google/innovation-and-ai/models-and-research/google-deepmind/',
      fetcher: fetchFromGoogleDeepMind
    }
  ];

  for (const config of siteConfigs) {
    console.log(`正在抓取 ${config.sourceName}...`);
    try {
      const items = await config.fetcher();
      const siteData = wrapSiteSource(
        config.source,
        config.sourceName,
        config.sourceUrl,
        items
      );
      results.sites.push(siteData);
      console.log(`  ✓ 成功抓取 ${items.length} 条新闻\n`);
      
      // 请求延迟，避免过于频繁
      await delay(CONFIG.REQUEST_DELAY);
    } catch (error) {
      console.error(`  ✗ 抓取失败: ${error.message}`);
      console.error(`  错误堆栈: ${error.stack}\n`);
      // 即使失败也添加空站点数据，前端会显示友好提示
      results.sites.push(wrapSiteSource(
        config.source,
        config.sourceName,
        config.sourceUrl,
        []
      ));
    }
  }

  // 确保输出目录存在
  const outputDir = path.dirname(CONFIG.OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 保存 JSON 文件
  fs.writeFileSync(
    CONFIG.OUTPUT_PATH,
    JSON.stringify(results, null, 2),
    'utf8'
  );

  console.log(`\n抓取完成！数据已保存到: ${CONFIG.OUTPUT_PATH}`);
  console.log(`共抓取 ${results.sites.length} 个站点`);
  const totalItems = results.sites.reduce((sum, site) => sum + site.items.length, 0);
  console.log(`共 ${totalItems} 条新闻`);
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  fetchFromMicrosoftDesign,
  fetchFromGoogleDesign,
  fetchFromFigma,
  fetchFromAnthropic,
  fetchFromOpenAI,
  fetchFromGoogleAI,
  fetchFromAWS,
  fetchFromAIBase,
  fetchFromJiqizhixin,
  fetchFromQbitai,
  fetchFromTechCrunch,
  fetchFromGoogleDeepMind,
  main
};
