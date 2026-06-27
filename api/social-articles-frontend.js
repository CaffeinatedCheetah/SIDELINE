// SIDELINE - Social Article Card + Feed Integration
// Drop this into your main index.html JavaScript section
// Handles rendering AI-written articles that originated from X posts

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Allowlist-based sanitizer — strips everything except elements needed for Twitter blockquote embeds
function sanitizeEmbed(html) {
  if (!html) return '';
  const ALLOWED = {
    blockquote: ['class','data-theme','data-lang','data-dnt'],
    p:          ['lang','dir'],
    a:          ['href','target','rel'],
    br:         [],
    span:       [],
  };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  function walk(node) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent);
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    const allowedAttrs = ALLOWED[tag];
    if (!allowedAttrs) return null;
    const el = document.createElement(tag);
    for (const attr of allowedAttrs) {
      if (node.hasAttribute(attr)) {
        const val = node.getAttribute(attr);
        if (attr === 'href' && !/^https?:\/\//i.test(val)) continue;
        el.setAttribute(attr, val);
      }
    }
    for (const child of node.childNodes) {
      const c = walk(child);
      if (c) el.appendChild(c);
    }
    return el;
  }
  const wrap = document.createElement('div');
  doc.body.childNodes.forEach(c => { const n = walk(c); if (n) wrap.appendChild(n); });
  return wrap.innerHTML;
}

// ============================================================
// FETCH SOCIAL ARTICLES FROM THE AGENT
// Call this alongside your existing news/video fetches
// ============================================================
async function fetchSocialArticles() {
  try {
    const response = await fetch('/api/agent-social', {
      headers: {
        'Authorization': `Bearer ${window.CRON_SECRET || ''}`,
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.articles || [];
  } catch (err) {
    console.warn('[Sideline] Social articles unavailable:', err.message);
    return [];
  }
}

// ============================================================
// RENDER A SOCIAL ARTICLE CARD
// Fits into your existing magazine-style feed layout
// ============================================================
function renderSocialArticleCard(article) {
  const timeAgo = getTimeAgo(new Date(article.publishedAt));
  const tagColor = getTagColor(article.tag);

  return `
    <article class="sideline-card social-article-card" data-id="${article.id}" data-sport="${article.sport}">
      
      <!-- Card Header -->
      <div class="card-header">
        <div class="source-badge">
          <img 
            src="${article.thumbnail}" 
            alt="@${article.sourceUsername}"
            class="athlete-avatar"
            onerror="this.src='https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'"
          />
          <div class="source-info">
            <span class="athlete-name">${escHtml(article.embedAuthor)}</span>
            <span class="source-platform">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @${escHtml(article.sourceUsername)}
            </span>
          </div>
        </div>
        <div class="card-meta">
          <span class="tag-badge" style="background: ${tagColor}">${escHtml(article.tag)}</span>
          <span class="time-ago">${escHtml(timeAgo)}</span>
        </div>
      </div>

      <!-- Article Content -->
      <div class="card-body">
        <h2 class="article-headline">${escHtml(article.headline)}</h2>
        <p class="article-subheadline">${escHtml(article.subheadline)}</p>

        <!-- X Embed (official Twitter embed) -->
        ${article.embed ? `
          <div class="x-embed-container">
            ${sanitizeEmbed(article.embed)}
          </div>
        ` : `
          <!-- Fallback if embed fails -->
          <a href="${escHtml(article.sourceUrl)}" target="_blank" rel="noopener" class="x-link-fallback">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            View post on X
          </a>
        `}

        <!-- AI-written article body -->
        <div class="article-body">
          ${article.body.split('\n').filter(p => p.trim()).map(p => `<p>${escHtml(p)}</p>`).join('')}
        </div>
      </div>

      <!-- Card Footer -->
      <div class="card-footer">
        <span class="ai-badge" title="Article written by Sideline AI">
          ⚡ Sideline AI
        </span>
        <div class="card-actions">
          <button class="btn-fire" onclick="voteOnArticle(${JSON.stringify(article.id)}, 'fire')">
            🔥 <span class="vote-count">0</span>
          </button>
          <button class="btn-ice" onclick="voteOnArticle(${JSON.stringify(article.id)}, 'ice')">
            🧊 <span class="vote-count">0</span>
          </button>
          <button class="btn-share" onclick="shareArticle(${JSON.stringify(article.id)}, ${JSON.stringify(article.headline)})">
            Share
          </button>
        </div>
      </div>

    </article>
  `;
}

// ============================================================
// INJECT SOCIAL ARTICLES INTO YOUR EXISTING FEED
// Call this after your main feed loads
// ============================================================
async function injectSocialArticles() {
  const articles = await fetchSocialArticles();
  if (!articles.length) return;

  const feedContainer = document.querySelector('.news-feed, .articles-feed, #main-feed, .feed-container');
  if (!feedContainer) {
    console.warn('[Sideline] Could not find feed container to inject social articles');
    return;
  }

  // Load Twitter widget script if not already loaded (for official embeds)
  if (!window.twttr) {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.head.appendChild(script);
  }

  // Insert articles into feed — interleave every 3rd position
  const existingCards = feedContainer.querySelectorAll('.sideline-card, .news-card, .article-card');
  
  articles.forEach((article, index) => {
    const html = renderSocialArticleCard(article);
    const insertPosition = (index + 1) * 3; // every 3rd card
    
    if (existingCards[insertPosition]) {
      existingCards[insertPosition].insertAdjacentHTML('beforebegin', html);
    } else {
      feedContainer.insertAdjacentHTML('beforeend', html);
    }
  });

  // Re-process Twitter embeds after DOM injection
  if (window.twttr?.widgets) {
    window.twttr.widgets.load();
  }

  console.log(`[Sideline] Injected ${articles.length} social articles into feed`);
}

// ============================================================
// HELPERS
// ============================================================
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getTagColor(tag) {
  const colors = {
    'Breaking': '#ef4444',
    'Video': '#8b5cf6',
    'Hot Take': '#f97316',
    'Must See': '#10b981',
    'Exclusive': '#3b82f6',
  };
  return colors[tag] || '#6b7280';
}

function voteOnArticle(articleId, vote) {
  // Hook into your existing Fan Takes voting system
  console.log(`Vote: ${vote} on ${articleId}`);
  // TODO: connect to your existing voting API
}

function shareArticle(articleId, headline) {
  if (navigator.share) {
    navigator.share({
      title: headline,
      url: `${window.location.origin}/article/${articleId}`,
    });
  } else {
    navigator.clipboard.writeText(`${window.location.origin}/article/${articleId}`);
  }
}

// ============================================================
// CSS STYLES - Add to your stylesheet
// ============================================================
const SOCIAL_ARTICLE_STYLES = `
.social-article-card {
  background: #1a1a2e;
  border: 1px solid #2d2d4e;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}

.social-article-card:hover {
  border-color: #4a4a8a;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.source-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.athlete-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #4a4a8a;
}

.source-info {
  display: flex;
  flex-direction: column;
}

.athlete-name {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
}

.source-platform {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time-ago {
  font-size: 12px;
  color: #6b7280;
}

.article-headline {
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  line-height: 1.3;
  margin: 0 0 6px 0;
}

.article-subheadline {
  font-size: 14px;
  color: #9ca3af;
  margin: 0 0 16px 0;
}

.x-embed-container {
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
}

.x-embed-container .twitter-tweet {
  margin: 0 auto !important;
}

.x-link-fallback {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #000;
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  margin: 12px 0;
}

.article-body p {
  font-size: 15px;
  line-height: 1.7;
  color: #d1d5db;
  margin: 0 0 12px 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #2d2d4e;
}

.ai-badge {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.btn-fire, .btn-ice, .btn-share {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #2d2d4e;
  background: transparent;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-fire:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }
.btn-ice:hover { background: rgba(59,130,246,0.2); border-color: #3b82f6; }
.btn-share:hover { background: rgba(255,255,255,0.1); }
`;

// Auto-inject styles
const styleEl = document.createElement('style');
styleEl.textContent = SOCIAL_ARTICLE_STYLES;
document.head.appendChild(styleEl);

// ============================================================
// AUTO-RUN on page load
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Small delay so main feed loads first
  setTimeout(injectSocialArticles, 2000);
});
