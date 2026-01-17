// ====================
// 配置
// ====================
const CONFIG = {
  DATA_URL: './data/today.json', // 数据文件路径
  SITE_ORDER: ['microsoft', 'google', 'figma', 'anthropic', 'metaai', 'googleai', 'stability', 'aws', 'googledeepmind'], // 站点显示顺序
};

// ====================
// 工具函数
// ====================

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 计算相对时间
function getRelativeTime(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDate(dateString);
  }
}

// ====================
// 翻译功能
// ====================

// 判断文本是否为中文
function isChinese(text) {
  if (!text) return false;
  // 检查是否包含中文字符
  return /[\u4e00-\u9fa5]/.test(text);
}

// 生成文本哈希（用于缓存 key）
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// 从 localStorage 获取缓存的翻译
function getCachedTranslation(text) {
  try {
    const cacheKey = `translation_${hashText(text)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (e) {
    console.warn('读取翻译缓存失败:', e);
  }
  return null;
}

// 保存翻译到 localStorage 缓存
function setCachedTranslation(text, translation) {
  try {
    const cacheKey = `translation_${hashText(text)}`;
    localStorage.setItem(cacheKey, translation);
  } catch (e) {
    console.warn('保存翻译缓存失败:', e);
    // 如果存储空间不足，清理一些旧的缓存
    try {
      const keys = Object.keys(localStorage);
      const translationKeys = keys.filter(k => k.startsWith('translation_'));
      if (translationKeys.length > 1000) {
        // 删除前500个旧的缓存
        translationKeys.slice(0, 500).forEach(k => localStorage.removeItem(k));
        // 重试保存
        localStorage.setItem(cacheKey, translation);
      }
    } catch (e2) {
      console.warn('清理缓存后仍无法保存:', e2);
    }
  }
}

// 单个标题翻译
async function translateTitle(text) {
  if (!text || text.trim().length === 0) {
    return text;
  }
  
  // 如果已经是中文，直接返回
  if (isChinese(text)) {
    return text;
  }
  
  // 检查缓存
  const cached = getCachedTranslation(text);
  if (cached) {
    return cached;
  }
  
  // 尝试使用 LibreTranslate 公共实例
  try {
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: 'zh',
        format: 'text'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.translatedText) {
      const translated = data.translatedText;
      // 缓存结果
      setCachedTranslation(text, translated);
      return translated;
    }
  } catch (error) {
    console.warn('LibreTranslate 翻译失败，尝试备用方案:', error);
    
    // 备用方案：使用 MyMemory Translation API
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
          const translated = data.responseData.translatedText;
          setCachedTranslation(text, translated);
          return translated;
        }
      }
    } catch (error2) {
      console.warn('备用翻译 API 也失败:', error2);
    }
  }
  
  // 所有翻译都失败，返回原文
  console.warn('翻译失败，使用原文:', text);
  return text;
}

// 批量翻译所有标题
async function translateAllTitles(data) {
  const startTime = Date.now();
  const translatedData = JSON.parse(JSON.stringify(data)); // 深拷贝
  
  // 收集所有需要翻译的标题
  const titlesToTranslate = [];
  for (let siteIndex = 0; siteIndex < translatedData.sites.length; siteIndex++) {
    const site = translatedData.sites[siteIndex];
    for (let itemIndex = 0; itemIndex < site.items.length; itemIndex++) {
      const item = site.items[itemIndex];
      if (item.title && !isChinese(item.title)) {
        titlesToTranslate.push({
          siteIndex,
          itemIndex,
          title: item.title
        });
      }
    }
  }
  
  console.log(`需要翻译 ${titlesToTranslate.length} 个标题`);
  
  if (titlesToTranslate.length === 0) {
    return translatedData;
  }
  
  // 分批翻译
  const batchSize = 5;
  for (let i = 0; i < titlesToTranslate.length; i += batchSize) {
    const batch = titlesToTranslate.slice(i, i + batchSize);
    
    // 并行翻译批次
    await Promise.all(batch.map(async ({ siteIndex, itemIndex, title }) => {
      try {
        const translated = await translateTitle(title);
        translatedData.sites[siteIndex].items[itemIndex].title = translated;
      } catch (error) {
        console.warn(`翻译标题失败: ${title}`, error);
        // 翻译失败时保持原文
      }
    }));
    
    // 批次间延迟，避免触发 API 频率限制
    if (i + batchSize < titlesToTranslate.length) {
      await delay(200);
    }
  }
  
  console.log(`翻译完成，耗时 ${Date.now() - startTime}ms`);
  return translatedData;
}

// ====================
// 加载动画控制
// ====================

let loadingTimer = null;

function showLoadingAnimation() {
  const loadingEl = document.getElementById('loadingTranslation');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
  }
}

function hideLoadingAnimation() {
  const loadingEl = document.getElementById('loadingTranslation');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

// ====================
// 渲染函数
// ====================

// 渲染新闻项（参考 momoyu.cc 的简洁风格）
function renderNewsItem(item, index) {
  // 只显示实际发布时间，如果 publishedAt 不存在或无效则不显示
  let publishedTime = '';
  if (item.publishedAt) {
    // 验证日期是否有效
    const publishDate = new Date(item.publishedAt);
    if (!isNaN(publishDate.getTime())) {
      // 日期有效，计算相对时间
      publishedTime = item.publishedAtRelative || getRelativeTime(item.publishedAt);
    }
  }
  
  const tags = item.tags && Array.isArray(item.tags) ? item.tags : [];
  const tagsHtml = tags.length > 0 
    ? `<div class="news-tags">${tags.map(tag => `<span class="news-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  const url = escapeHtml(item.url);
  return `
    <article class="news-item" data-url="${url}" role="button" tabindex="0" aria-label="查看 ${escapeHtml(item.title)}">
      <div class="news-content">
        <div class="news-header">
          <span class="news-number">${index + 1}.</span>
          <h3 class="news-title">${escapeHtml(item.title)}</h3>
          ${publishedTime ? `<span class="news-published-time">${publishedTime}</span>` : ''}
        </div>
        ${tagsHtml}
      </div>
    </article>
  `;
}

// 渲染站点卡片
function renderSiteCard(site) {
  const hasItems = site.items && site.items.length > 0;
  
  let contentHtml = '';
  
  if (hasItems) {
    const newsItemsHtml = site.items
      .map((item, index) => renderNewsItem(item, index))
      .join('');
    contentHtml = `<div class="news-list">${newsItemsHtml}</div>`;
  } else {
    contentHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p class="empty-state-message">暂无可用的 AI 设计内容</p>
        <a href="${escapeHtml(site.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="empty-state-link">
          访问 ${escapeHtml(site.sourceName)}
        </a>
      </div>
    `;
  }

  return `
    <div class="site-card">
      <div class="site-card-header">
        <h2 class="site-card-title">${escapeHtml(site.sourceName)}</h2>
      </div>
      ${contentHtml}
    </div>
  `;
}

// 渲染所有站点卡片
function renderSiteCards(data) {
  console.log('开始渲染站点卡片，数据:', data);
  const container = document.getElementById('siteCardsContainer');
  
  if (!container) {
    console.error('找不到容器元素 siteCardsContainer');
    return;
  }
  
  if (!data || !data.sites || data.sites.length === 0) {
    console.warn('数据为空或格式不正确');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p class="empty-state-message">暂无数据，请稍后再试</p>
      </div>
    `;
    return;
  }

  console.log(`找到 ${data.sites.length} 个站点，开始渲染...`);

  // 按固定顺序排序站点
  const sortedSites = CONFIG.SITE_ORDER
    .map(source => data.sites.find(site => site.source === source))
    .filter(Boolean);

  console.log(`排序后 ${sortedSites.length} 个站点`);

  const cardsHtml = sortedSites.map(site => renderSiteCard(site)).join('');
  container.innerHTML = cardsHtml;

  console.log('站点卡片渲染完成');

  // 添加点击和触摸事件监听器（移动端优化）
  const newsItems = container.querySelectorAll('.news-item');
  newsItems.forEach(item => {
    const url = item.getAttribute('data-url');
    if (!url) return;
    
    // 统一的打开链接函数
    const openLink = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank');
    };
    
    // 点击事件（桌面端和移动端都支持）
    item.addEventListener('click', openLink);
    
    // 触摸事件（移动端优化，减少延迟）
    let touchStartTime = 0;
    item.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      item.style.opacity = '0.7';
    }, { passive: true });
    
    item.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - touchStartTime;
      item.style.opacity = '1';
      
      // 如果触摸时间小于 300ms，认为是点击而不是滑动
      if (touchDuration < 300) {
        e.preventDefault();
        openLink(e);
      }
    });
    
    item.addEventListener('touchcancel', () => {
      item.style.opacity = '1';
    }, { passive: true });
  });

  // 更新日期显示
  if (data.date) {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
      dateElement.textContent = data.date;
      console.log('日期已更新:', data.date);
    }
  }
}

// ====================
// 数据加载
// ====================

async function loadData() {
  const container = document.getElementById('siteCardsContainer');
  
  if (!container) {
    console.error('找不到容器元素 siteCardsContainer');
    return;
  }
  
  console.log('开始加载数据，URL:', CONFIG.DATA_URL);
  
  try {
    // 添加超时控制（30秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(CONFIG.DATA_URL, {
      signal: controller.signal,
      cache: 'no-cache', // 确保获取最新数据
      headers: {
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    console.log('响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('数据加载成功:', data);
    
    // 验证数据格式
    if (!data || !data.sites || !Array.isArray(data.sites)) {
      throw new Error('数据格式不正确：缺少 sites 数组');
    }
    
    console.log(`找到 ${data.sites.length} 个站点`);
    
    // 后台翻译所有标题
    const startTime = Date.now();
    
    // 设置5秒定时器，如果翻译时间超过5秒，显示加载动画
    loadingTimer = setTimeout(() => {
      if (Date.now() - startTime >= 5000) {
        showLoadingAnimation();
      }
    }, 5000);
    
    // 后台翻译
    console.log('开始后台翻译标题...');
    try {
      const translatedData = await translateAllTitles(data);
      
      // 清除定时器
      if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
      
      // 隐藏加载动画（如果显示了）
      hideLoadingAnimation();
      
      // 渲染翻译后的内容
      console.log('翻译完成，开始渲染内容...');
      renderSiteCards(translatedData);
    } catch (error) {
      console.error('翻译过程出错:', error);
      // 清除定时器
      if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }
      // 隐藏加载动画
      hideLoadingAnimation();
      // 即使翻译失败，也渲染原始数据
      renderSiteCards(data);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 检查是否是超时错误
    const isTimeoutError = error.name === 'AbortError' || 
                           error.message.includes('timeout') ||
                           error.message.includes('aborted');
    
    // 检查是否是 CORS 问题
    const isCorsError = error.message.includes('CORS') || 
                       error.message.includes('Failed to fetch') ||
                       error.message.includes('NetworkError') ||
                       error.name === 'TypeError';
    
    // 检查是否是网络错误
    const isNetworkError = error.message.includes('NetworkError') ||
                          error.message.includes('network') ||
                          isTimeoutError;
    
    let errorMessage = '数据加载失败，请稍后再试';
    let errorDetail = error.message;
    let errorIcon = '❌';
    
    if (isTimeoutError) {
      errorMessage = '数据加载超时';
      errorDetail = '可能是网络较慢或服务器响应延迟。请检查网络连接，或稍后重试。';
      errorIcon = '⏱️';
    } else if (isNetworkError && !isTimeoutError) {
      errorMessage = '网络连接失败';
      errorDetail = '请检查网络连接，确保可以访问互联网。';
      errorIcon = '📡';
    } else if (isCorsError && error.message.includes('fetch')) {
      errorMessage = '无法加载数据文件（CORS 限制）';
      errorDetail = '请使用本地服务器访问，而不是直接打开 HTML 文件。\n启动方法：python3 -m http.server 8000\n然后访问：http://localhost:8000';
    }
    
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${errorIcon}</div>
        <p class="empty-state-message">${escapeHtml(errorMessage)}</p>
        <p class="empty-state-message" style="font-size: 12px; margin-top: 8px; white-space: pre-line; color: var(--text-secondary);">${escapeHtml(errorDetail)}</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
          重新加载
        </button>
        <p class="empty-state-message" style="font-size: 11px; margin-top: 8px; color: #9ca3af;">如果问题持续，请检查网络连接或稍后重试</p>
      </div>
    `;
  }
}

// ====================
// Back to Top 功能
// ====================

function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  
  if (!backToTopBtn) return;

  function toggleBackToTop() {
    if (window.pageYOffset > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', toggleBackToTop);
  
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // 支持键盘操作
  backToTopBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  });
}

// ====================
// 键盘导航支持
// ====================

function initKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    // 为新闻项添加键盘支持
    const newsItems = document.querySelectorAll('.news-item');
    newsItems.forEach(item => {
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const url = item.getAttribute('onclick');
          if (url) {
            const match = url.match(/window\.open\('([^']+)'/);
            if (match) {
              window.open(match[1], '_blank');
            }
          }
        }
      });
    });
  });
}

// ====================
// 初始化
// ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('页面加载完成，开始初始化...');
  
  // 设置当前日期
  const today = formatDate(new Date().toISOString());
  const dateElement = document.getElementById('currentDate');
  if (dateElement && !dateElement.textContent) {
    dateElement.textContent = today;
    console.log('日期已设置:', today);
  }

  // 加载数据
  console.log('准备加载数据...');
  loadData();

  // 初始化 Back to Top
  initBackToTop();

  // 初始化键盘导航
  initKeyboardNavigation();
  
  console.log('初始化完成');
});

// 如果 DOM 已经加载完成，立即执行
if (document.readyState === 'loading') {
  // DOM 还在加载中，等待 DOMContentLoaded 事件
  console.log('等待 DOM 加载...');
} else {
  // DOM 已经加载完成，立即执行
  console.log('DOM 已加载，立即执行初始化');
  const today = formatDate(new Date().toISOString());
  const dateElement = document.getElementById('currentDate');
  if (dateElement && !dateElement.textContent) {
    dateElement.textContent = today;
  }
  loadData();
  initBackToTop();
  initKeyboardNavigation();
}
