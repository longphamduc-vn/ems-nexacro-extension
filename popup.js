/**
 * popup.js - Modernized Extension UI Controller
 * Manages DevTools-grade inspection UI, real-time filtering, structured XML views, and dependency lineage.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ems_captured_apis';

  // DOM references
  const apiListContainer = document.getElementById('apiList');
  const btnExport = document.getElementById('btnExport');
  const btnClear = document.getElementById('btnClear');
  const searchInput = document.getElementById('searchInput');
  const countAllEl = document.getElementById('countAll');
  const countDepsEl = document.getElementById('countDeps');
  const countErrorsEl = document.getElementById('countErrors');
  const toastEl = document.getElementById('toast');
  const filterChips = document.querySelectorAll('.chip');

  let currentLogs = [];
  let computedLogs = [];
  let activeFilter = 'all'; // 'all', 'deps', 'errors'
  let toastTimer = null;

  document.addEventListener('DOMContentLoaded', () => {
    loadLogs();
    setupEventListeners();
  });

  function setupEventListeners() {
    btnExport.addEventListener('click', handleExportJSON);
    btnClear.addEventListener('click', handleClearLogs);
    searchInput.addEventListener('input', renderList);

    filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        filterChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter') || 'all';
        renderList();
      });
    });
  }

  /**
   * Retrieves logs and computes dependencies & parsed structures.
   */
  function loadLogs() {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      currentLogs = res[STORAGE_KEY] || [];
      if (!Array.isArray(currentLogs)) currentLogs = [];

      computeDataAndLineage();
      updateHeaderCounts();
      renderList();
    });
  }

  /**
   * Pre-processes logs with dependencyEngine.js
   */
  function computeDataAndLineage() {
    computedLogs = [];

    for (let i = 0; i < currentLogs.length; i++) {
      const current = currentLogs[i];
      const pastApis = currentLogs.slice(0, i);

      let dependencies = [];
      let parsedRequest = null;
      let parsedResponse = null;

      if (window.NexacroDependencyEngine) {
        if (current.requestBody) {
          parsedRequest = window.NexacroDependencyEngine.parseNexacroXML(current.requestBody);
          if (pastApis.length > 0) {
            dependencies = window.NexacroDependencyEngine.findDependencies(parsedRequest, pastApis);
          }
        }
        if (current.responseBody) {
          parsedResponse = window.NexacroDependencyEngine.parseNexacroXML(current.responseBody);
        }
      }

      computedLogs.push({
        ...current,
        index: i + 1,
        parsedRequest: parsedRequest,
        parsedResponse: parsedResponse,
        dependencies: dependencies
      });
    }
  }

  function updateHeaderCounts() {
    const total = computedLogs.length;
    const depsCount = computedLogs.filter((item) => item.dependencies && item.dependencies.length > 0).length;
    const errorsCount = computedLogs.filter((item) => item.status >= 400 || item.status === 0).length;

    countAllEl.textContent = String(total);
    countDepsEl.textContent = String(depsCount);
    countErrorsEl.textContent = String(errorsCount);
  }

  /**
   * Renders the filtered and searched API items.
   */
  function renderList() {
    const query = (searchInput.value || '').trim().toLowerCase();
    apiListContainer.innerHTML = '';

    const filtered = computedLogs.filter((item) => {
      // 1. Chip filter check
      if (activeFilter === 'deps' && (!item.dependencies || item.dependencies.length === 0)) {
        return false;
      }
      if (activeFilter === 'errors' && !(item.status >= 400 || item.status === 0)) {
        return false;
      }

      // 2. Search query check
      if (!query) return true;
      const inUrl = item.url.toLowerCase().includes(query);
      const inMethod = item.method.toLowerCase().includes(query);
      const inStatus = String(item.status).includes(query);
      return inUrl || inMethod || inStatus;
    });

    if (filtered.length === 0) {
      apiListContainer.innerHTML = `
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <div class="empty-title">No Nexacro Traffic Found</div>
          <div class="empty-desc">Make HTTP requests on your EMS Nexacro application to monitor parameters, datasets, and API data dependencies.</div>
        </div>
      `;
      return;
    }

    filtered.forEach((api) => {
      const card = createApiCard(api);
      apiListContainer.appendChild(card);
    });
  }

  /**
   * Builds an interactive API entry card.
   */
  function createApiCard(api) {
    const card = document.createElement('div');
    card.className = 'api-card';

    const isPost = api.method === 'POST';
    const methodClass = isPost ? 'method-post' : 'method-get';
    const isSuccess = api.status >= 200 && api.status < 300;
    const statusClass = isSuccess ? 'status-2xx' : 'status-err';
    const depCount = api.dependencies ? api.dependencies.length : 0;

    // Parse URL for clean display
    let urlPath = api.url;
    let urlHost = '';
    try {
      const parsedUrl = new URL(api.url);
      urlPath = parsedUrl.pathname + parsedUrl.search;
      urlHost = parsedUrl.host;
    } catch (e) {
      // Relative or non-standard URL
    }

    const durationText = api.durationMs ? `${api.durationMs}ms` : '';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-meta-left">
          <span class="method-badge ${methodClass}">${escapeHtml(api.method)}</span>
          <span class="status-badge ${statusClass}">${api.status || 'ERR'}</span>
          <div class="url-display" title="${escapeHtml(api.url)}">
            <span class="url-path">${escapeHtml(urlPath)}</span>
            ${urlHost ? `<span class="url-host">${escapeHtml(urlHost)}</span>` : ''}
          </div>
        </div>
        <div class="card-meta-right">
          ${
            depCount > 0
              ? `<div class="dep-pill" title="${depCount} variables linked from prior APIs">
                   <span>⚡</span> ${depCount} Linked
                 </div>`
              : ''
          }
          ${durationText ? `<span class="duration-label">${durationText}</span>` : ''}
          <svg class="chevron-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div class="card-drawer">
        <div class="drawer-tabs">
          <div class="nav-tabs">
            <button class="tab-btn tab-dep ${depCount > 0 ? 'active' : ''}" data-pane="deps">
              ⚡ Dependencies (${depCount})
            </button>
            <button class="tab-btn ${depCount === 0 ? 'active' : ''}" data-pane="payload">
              Payload (Request)
            </button>
            <button class="tab-btn" data-pane="response">
              Response
            </button>
          </div>
          <div class="view-mode-toggle" title="Switch between structured tables and raw formatted XML">
            <div class="toggle-opt active" data-mode="structured">Structured</div>
            <div class="toggle-opt" data-mode="raw">Raw XML</div>
          </div>
        </div>

        <!-- Dependencies Tab -->
        <div class="tab-pane ${depCount > 0 ? 'active' : ''}" data-pane-content="deps">
          ${renderDependenciesPane(api.dependencies)}
        </div>

        <!-- Payload Tab -->
        <div class="tab-pane ${depCount === 0 ? 'active' : ''}" data-pane-content="payload">
          <div class="pane-view-structured">
            ${renderStructuredXml(api.parsedRequest, 'Request')}
          </div>
          <div class="pane-view-raw" style="display: none;">
            <div class="raw-code-container">
              <div class="raw-code-actions">
                <button class="btn-secondary btn-copy-raw" data-copy="${escapeAttr(api.requestBody)}">
                  Copy XML
                </button>
              </div>
              <pre class="code-view">${formatAndHighlightXml(api.requestBody)}</pre>
            </div>
          </div>
        </div>

        <!-- Response Tab -->
        <div class="tab-pane" data-pane-content="response">
          <div class="pane-view-structured">
            ${renderStructuredXml(api.parsedResponse, 'Response')}
          </div>
          <div class="pane-view-raw" style="display: none;">
            <div class="raw-code-container">
              <div class="raw-code-actions">
                <button class="btn-secondary btn-copy-raw" data-copy="${escapeAttr(api.responseBody)}">
                  Copy XML
                </button>
              </div>
              <pre class="code-view">${formatAndHighlightXml(api.responseBody)}</pre>
            </div>
          </div>
        </div>
      </div>
    `;

    // Accordion toggle
    const header = card.querySelector('.card-header');
    header.addEventListener('click', () => {
      card.classList.toggle('open');
    });

    // Sub-tabs switching
    const tabBtns = card.querySelectorAll('.tab-btn');
    const tabPanes = card.querySelectorAll('.tab-pane');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-pane');
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = card.querySelector(`.tab-pane[data-pane-content="${target}"]`);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Structured vs Raw view mode toggle
    const toggleOpts = card.querySelectorAll('.toggle-opt');
    toggleOpts.forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpts.forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        const mode = opt.getAttribute('data-mode');

        const activePane = card.querySelector('.tab-pane.active');
        if (activePane) {
          const structView = activePane.querySelector('.pane-view-structured');
          const rawView = activePane.querySelector('.pane-view-raw');
          if (structView && rawView) {
            if (mode === 'structured') {
              structView.style.display = 'block';
              rawView.style.display = 'none';
            } else {
              structView.style.display = 'none';
              rawView.style.display = 'block';
            }
          }
        }
      });
    });

    // Copy XML buttons
    const copyRawBtns = card.querySelectorAll('.btn-copy-raw');
    copyRawBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy');
        copyToClipboard(text);
      });
    });

    // Delegated copy buttons inside card (XPath, values)
    card.addEventListener('click', (e) => {
      const copyTarget = e.target.closest('[data-copy-text]');
      if (copyTarget) {
        e.stopPropagation();
        const text = copyTarget.getAttribute('data-copy-text');
        copyToClipboard(text);
      }
    });

    return card;
  }

  /**
   * Renders the dependencies flow view with visual cards.
   */
  function renderDependenciesPane(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
          No incoming data dependencies detected. All values appear to be user inputs or constants.
        </div>
      `;
    }

    let itemsHtml = '';
    dependencies.forEach((d) => {
      let sourceUrlShort = d.sourceApiUrl;
      try {
        const u = new URL(d.sourceApiUrl);
        sourceUrlShort = u.pathname;
      } catch (e) {}

      itemsHtml += `
        <div class="dep-flow-item">
          <div class="dep-row-top">
            <div class="dep-target-field">
              <span>Target: <strong>${escapeHtml(d.targetKey)}</strong></span>
            </div>
            <div class="dep-val-pill" title="Click to copy value" data-copy-text="${escapeAttr(d.targetValue)}" style="cursor: pointer;">
              "${escapeHtml(d.targetValue)}" 📋
            </div>
          </div>

          <div class="dep-lineage-flow">
            <div class="flow-col">
              <span class="flow-label">Target XPath (This Request)</span>
              <div class="xpath-pill">
                <span>${escapeHtml(d.targetLocation)}</span>
                <button class="copy-btn" title="Copy XPath" data-copy-text="${escapeAttr(d.targetLocation)}">📋</button>
              </div>
            </div>

            <div class="flow-arrow">➔</div>

            <div class="flow-col">
              <span class="flow-label">Source Origin: ${escapeHtml(d.sourceMethod)} ${escapeHtml(sourceUrlShort)}</span>
              <div class="xpath-pill source">
                <span>${escapeHtml(d.sourceXPath)}</span>
                <button class="copy-btn" title="Copy XPath" data-copy-text="${escapeAttr(d.sourceXPath)}">📋</button>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    return `<div class="dep-flow-container">${itemsHtml}</div>`;
  }

  /**
   * Renders structured Parameters & Datasets tables.
   */
  function renderStructuredXml(parsedObj, label) {
    if (!parsedObj || !parsedObj.isValidNexacro) {
      return `
        <div style="padding: 12px; color: var(--text-muted); font-size: 12px;">
          No Nexacro Parameters or Datasets detected in this ${label}. Switch to "Raw XML" view to see full payload.
        </div>
      `;
    }

    let html = '';

    // 1. Parameters Table
    const paramKeys = Object.keys(parsedObj.parameters || {});
    if (paramKeys.length > 0) {
      let rows = '';
      paramKeys.forEach((key) => {
        const p = parsedObj.parameters[key];
        rows += `
          <tr>
            <td style="font-weight: 600; color: #60a5fa;">${escapeHtml(p.id)}</td>
            <td style="color: #34d399;">${escapeHtml(p.value)}</td>
            <td style="color: var(--text-faint);">${escapeHtml(p.xpath)}</td>
            <td style="text-align: right;">
              <button class="copy-btn" title="Copy XPath" data-copy-text="${escapeAttr(p.xpath)}">📋</button>
            </td>
          </tr>
        `;
      });

      html += `
        <div class="structured-section">
          <div class="structured-header">
            <span>Parameters (${paramKeys.length})</span>
          </div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Parameter ID</th>
                  <th>Value</th>
                  <th>XPath</th>
                  <th style="width: 30px;"></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 2. Datasets Tables
    const datasetKeys = Object.keys(parsedObj.datasets || {});
    if (datasetKeys.length > 0) {
      datasetKeys.forEach((dsId) => {
        const ds = parsedObj.datasets[dsId];
        const cols = ds.columns || [];
        const rows = ds.rows || [];

        let ths = `<th>#</th>`;
        cols.forEach((col) => {
          ths += `<th>${escapeHtml(col.id)}</th>`;
        });

        let trs = '';
        rows.forEach((row, rIdx) => {
          let tds = `<td style="color: var(--text-faint);">${rIdx + 1}</td>`;
          cols.forEach((col) => {
            const cellVal = row[col.id] || '';
            tds += `<td>${escapeHtml(cellVal)}</td>`;
          });
          trs += `<tr>${tds}</tr>`;
        });

        if (rows.length === 0) {
          trs = `<tr><td colspan="${cols.length + 1}" style="text-align: center; color: var(--text-faint);">0 rows</td></tr>`;
        }

        html += `
          <div class="structured-section" style="margin-top: 10px;">
            <div class="structured-header">
              <span>Dataset: <strong style="color: #c084fc;">${escapeHtml(dsId)}</strong> (${rows.length} rows, ${cols.length} cols)</span>
            </div>
            <div class="data-table-wrapper">
              <table class="data-table">
                <thead><tr>${ths}</tr></thead>
                <tbody>${trs}</tbody>
              </table>
            </div>
          </div>
        `;
      });
    }

    return html;
  }

  /**
   * Indents and syntax-highlights XML strings for comfortable reading.
   */
  function formatAndHighlightXml(xml) {
    if (!xml || typeof xml !== 'string') return '<span style="color: var(--text-faint);">(empty)</span>';
    const trimmed = xml.trim();
    if (!trimmed.startsWith('<')) return escapeHtml(trimmed);

    try {
      // 1. Indent XML
      let formatted = '';
      const reg = /(>)(<)(\/*)/g;
      const cleanXml = trimmed.replace(reg, '$1\r\n$2$3');
      let pad = 0;

      const lines = cleanXml.split('\r\n');
      lines.forEach((node) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (node.match(/^<\/\w/)) {
          if (pad !== 0) pad -= 1;
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        let padding = '';
        for (let i = 0; i < pad; i++) {
          padding += '  ';
        }
        formatted += padding + node + '\n';
        pad += indent;
      });

      // 2. Syntax Highlight with safe HTML escaping
      const escaped = escapeHtml(formatted.trim());
      // Color tags, attributes, and values
      const highlighted = escaped
        .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="xml-tag">$2</span>')
        .replace(/([\w:-]+)(=)(&quot;.*?&quot;)/g, '<span class="xml-attr-name">$1</span>$2<span class="xml-attr-val">$3</span>')
        .replace(/(&gt;)([^&<\n]+)(&lt;)/g, '$1<span class="xml-text">$2</span>$3');

      return highlighted;
    } catch (e) {
      return escapeHtml(trimmed);
    }
  }

  /**
   * Copy string to clipboard with interactive toast notification.
   */
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy');
    });
  }

  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 1800);
  }

  /**
   * Export all captured records into a structured JSON file.
   */
  function handleExportJSON() {
    if (computedLogs.length === 0) {
      alert('No API records captured yet.');
      return;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      generator: 'EMS Nexacro XML Interceptor & Dependency Engine',
      totalRequests: computedLogs.length,
      chain: computedLogs.map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        durationMs: item.durationMs,
        clientType: item.clientType,
        method: item.method,
        url: item.url,
        status: item.status,
        statusText: item.statusText,
        requestHeaders: item.requestHeaders,
        requestBodyRaw: item.requestBody,
        requestParsed: item.parsedRequest,
        responseHeaders: item.responseHeaders,
        responseBodyRaw: item.responseBody,
        responseParsed: item.parsedResponse,
        dependencies: item.dependencies || []
      }))
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `nexacro_api_chain_${Date.now()}.json`;

    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * Clear storage logs.
   */
  function handleClearLogs() {
    if (!confirm('Clear all captured Nexacro API logs?')) return;
    chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
      currentLogs = [];
      computedLogs = [];
      chrome.action.setBadgeText({ text: '' });
      updateHeaderCounts();
      renderList();
      showToast('Logs cleared');
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();