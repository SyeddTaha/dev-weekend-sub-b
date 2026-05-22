const form = document.getElementById('check-form');
const input = document.getElementById('url-input');
const submitButton = document.getElementById('submit-button');
const statusArea = document.getElementById('status-area');
const resultArea = document.getElementById('result-area');
const historyArea = document.getElementById('history-area');
const clearHistoryButton = document.getElementById('clear-history');

const HISTORY_KEY = 'url-risk-checker-history';

renderHistory();
renderEmptyState();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = input.value.trim();

  if (!url) {
    showStatus('Please enter a URL.', true);
    return;
  }

  setLoading(true);
  showStatus('Checking URLhaus...', false);
  clearResult();

  try {
    const response = await fetch('/api/check-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Lookup failed.');
    }

    showStatus(data.cached ? 'Loaded from recent results.' : 'Lookup completed.', false);
    renderResult(data.result);
    saveHistory(url, data.result);
    renderHistory();
  } catch (error) {
    showStatus(error.message || 'Something went wrong.', true);
    renderErrorState(error.message || 'Unable to complete the lookup.');
  } finally {
    setLoading(false);
  }
});

clearHistoryButton.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  input.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Checking...' : 'Check URL';
}

function showStatus(message, isError) {
  statusArea.textContent = message;
  statusArea.classList.toggle('error', Boolean(isError));
}

function clearResult() {
  resultArea.innerHTML = '';
}

function renderEmptyState() {
  resultArea.innerHTML = '<div class="empty-state">No lookup yet. Paste a URL and run a check.</div>';
}

function renderErrorState(message) {
  resultArea.innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <h2 class="verdict">Error</h2>
        <span class="badge unknown">Unknown</span>
      </div>
      <div class="result-grid">
        <section class="result-section">
          <h3>Explanation</h3>
          <p>${escapeHtml(message)}</p>
        </section>
      </div>
    </div>
  `;
}

function renderResult(result) {
  const matched = result.matchedData;
  const matchedSection = matched
    ? `
      <section class="result-section">
        <h3>Matched data</h3>
        <dl class="kv">
          ${row('URLhaus ID', matched.id)}
          ${row('URL', matched.url)}
          ${row('Status', matched.urlStatus)}
          ${row('Date added', matched.dateAdded)}
          ${row('Last online', matched.lastOnline)}
          ${row('Threat', matched.threat)}
          ${row('Reporter', matched.reporter)}
          ${row('Reported to host', matched.larted)}
        </dl>
        ${renderTags(matched.tags)}
      </section>
      <section class="result-section">
        <h3>Payloads</h3>
        ${renderPayloads(matched.payloads)}
      </section>
    `
    : '';

  resultArea.innerHTML = `
    <div class="result-card">
      <div class="result-top">
        <h2 class="verdict">${escapeHtml(result.verdict)}</h2>
        <span class="badge ${escapeHtml(result.verdictKey)}">${escapeHtml(result.verdict)}</span>
      </div>
      <p class="small">${escapeHtml(result.explanation)}</p>
      <div class="result-grid">
        <section class="result-section">
          <h3>Lookup summary</h3>
          <dl class="kv">
            ${row('URLhaus reference', result.reference)}
          </dl>
        </section>
        ${matchedSection}
      </div>
    </div>
  `;
}

function renderTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }

  return `
    <ul class="tags">
      ${tags.map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`).join('')}
    </ul>
  `;
}

function renderPayloads(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    return '<p class="small">No payload details were returned.</p>';
  }

  return payloads.map((payload) => `
    <div class="history-item">
      <div class="url">${escapeHtml(payload.filename || 'Unnamed payload')}</div>
      <div class="meta">First seen: ${escapeHtml(payload.firstseen || 'n/a')}</div>
      <div class="meta">Last seen: ${escapeHtml(payload.lastseen || 'n/a')}</div>
      <div class="meta">URL: ${escapeHtml(payload.url || 'n/a')}</div>
      <div class="meta">Reference: ${escapeHtml(payload.reference || 'n/a')}</div>
    </div>
  `).join('');
}

function row(label, value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return `<div class="kv-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function saveHistory(url, result) {
  const history = loadHistory();
  const nextEntry = {
    url,
    verdict: result.verdict,
    time: new Date().toISOString()
  };

  const nextHistory = [nextEntry, ...history.filter((entry) => entry.url !== url)].slice(0, 5);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyArea.innerHTML = '<div class="empty-state">Recent lookups appear here after you run a check.</div>';
    return;
  }

  historyArea.innerHTML = history
    .map(
      (entry) => `
        <article class="history-item">
          <div class="url">${escapeHtml(entry.url)}</div>
          <div class="meta">${escapeHtml(entry.verdict)} · ${escapeHtml(formatTime(entry.time))}</div>
        </article>
      `
    )
    .join('');
}

function formatTime(value) {
  if (!value) {
    return 'n/a';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
