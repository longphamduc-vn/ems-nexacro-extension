/**
 * popup.js - Extension UI Controller & Data Flow Coordinator
 * Connects storage logs, runs real-time dependency analysis, updates UI, and triggers downloads.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ems_captured_apis';

  // DOM Elements
  const apiListContainer = document.getElementById('apiList');
  const trafficCountEl = document.getElementById('trafficCount');
  const btnExport = document.getElementById('btnExport');
  const btnClear = document.getElementById('btnClear');
  const searchInput = document.getElementById('searchInput');

  let currentLogs = [];
  let computedLogsWithDependencies = [];

  /**
   * Initialize popup view.
   */
  document.addEventListener('DOMContentLoaded', () => {
    loadLogs();
    setupEventListeners();
  });

  function setupEventListeners() {
    btnExport.addEventListener('click', handleExportJSON);
    btnClear.addEventListener('click', handleClearLogs);
    searchInput.addEventListener('input', handleFilterChange);
  }

  /**
   * Fetches data from chrome.storage.local and recalculates dependencies.
   */
  function loadLogs() {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      currentLogs = res[STORAGE_KEY] || [];
      if (!Array.isArray(currentLogs)) currentLogs = [];

      computeAllDependencies();
      renderList();
    });
  }

  /**
   * Runs dependencyEngine.js sequentially across all intercepted APIs.
   */
  function computeAllDependencies() {
    computedLogsWithDependencies = [];

    for (let i = 0; i < currentLogs.length; i++) {
      const currentApi = currentLogs[i];
      // Past APIs strictly preceding the current API in time
      const pastApis = currentLogs.slice(0, i);

      let dependencies = [];
      if (
        window.NexacroDependencyEngine &&
        currentApi.requestBody &&
        pastApis.length > 0
      ) {
        dependencies = window.NexacroDependencyEngine.findDependencies(
          currentApi.requestBody,
          pastApis
        );
      }

      computedLogsWithDependencies.push({
        ...currentApi,
        dependencies: dependencies
      });
    }
  }

  /**
   * Renders the scrollable API list with cards and accordion tabs.
   */
  function renderList() {
    const filterText = (searchInput.value || '').trim().toLowerCase();
    apiListContainer.innerHTML = '';

    const filtered = computedLogsWithDependencies.filter((item) => {
      if (!filterText) return true;
      return (
        item.url.toLowerCase().includes(filterText) ||
        item.method.toLowerCase().includes(filterText)
      );
    });

    trafficCountEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      apiListContainer.innerHTML = `
        <div class="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p>No Nexacro XML requests captured yet.</p>
          <span style="font-size: 11px;">Interact with your EMS application to see traffic.</span>
        </div>
      `;
      return;
    }

    filtered.forEach((api, index) => {
      const card = createApiCard(api, index);
      apiListContainer.appendChild(card);
    });
  }

  /**
   * Creates an interactive API entry element.
   */
  function createApiCard(api, index) {
    const card = document.createElement('div');
    card.className = 'api-card';

    const isPost = api.method === 'POST';
    const methodBadgeClass = isPost ? 'badge-post' : 'badge-get';
    const isStatusOk = api.status >= 200 && api.status < 300;
    const statusClass = isStatusOk ? 'status-2xx' : 'status-err';
    const depCount = api.dependencies ? api.dependencies.length : 0;

    const formattedTime = new Date(api.timestamp).toLocaleTimeString();

    card.innerHTML = `
      <div class="api-summary" data-index="${index}">
        <div class="api-meta-left">
          <span class="badge ${methodBadgeClass}">${api.method}</span>
          <span class="status-badge ${statusClass}">${api.status || '---'}</span>
          <span class="url-label" title="${escapeHtml(api.url)}">${escapeHtml(api.url)}</span>
        </div>
        <div class="api-meta-right">
          ${
            depCount > 0
              ? `<span class="dep-count-badge" title="${depCount} data lineage dependencies detected">⚡ ${depCount}</span>`
              : ''
          }
          <span class="time-label">${formattedTime}</span>
        </div>
      </div>
      <div class="api-details">
        <div class="tabs-header">
          <button class="tab-btn active" data-tab="payload">Payload</button>
          <button class="tab-btn" data-tab="response">Response</button>
          <button class="tab-btn" data-tab="deps">Dependencies (${depCount})</button>
        </div>
        <div class="tab-content active" data-content="payload">
          <pre class="code-view">${escapeHtml(formatXmlOrRaw(api.requestBody))}</pre>
        </div>
        <div class="tab-content" data-content="response">
          <pre class="code-view">${escapeHtml(formatXmlOrRaw(api.responseBody))}</pre>
        </div>
        <div class="tab-content" data-content="deps">
          ${renderDependenciesTabContent(api.dependencies)}
        </div>
      </div>
    `;

    // Accordion toggle
    const summary = card.querySelector('.api-summary');
    summary.addEventListener('click', () => {
      card.classList.toggle('open');
    });

    // Sub-tabs switching
    const tabButtons = card.querySelectorAll('.tab-btn');
    const tabContents = card.querySelectorAll('.tab-content');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = btn.getAttribute('data-tab');

        tabButtons.forEach((b) => b.classList.remove('active'));
        tabContents.forEach((c) => c.classList.remove('active'));

        btn.classList.add('active');
        card.querySelector(`.tab-content[data-content="${targetTab}"]`).classList.add('active');
      });
    });

    return card;
  }

  /**
   * Renders the dependencies table inside the accordion.
   */
  function renderDependenciesTabContent(dependencies) {
    if (!dependencies || dependencies.length === 0) {
      return '<div style="color: #94a3b8; font-size: 11px; padding: 6px;">No values linked to previous API responses.</div>';
    }

    let rowsHtml = '';
    dependencies.forEach((d) => {
      const sourceUrlShort = d.sourceApiUrl.split('/').pop() || d.sourceApiUrl;
      rowsHtml += `
        <tr>
          <td>
            <div class="xpath-tag" title="${escapeHtml(d.targetLocation)}">${escapeHtml(d.targetLocation)}</div>
            <div style="margin-top: 2px;"><span class="val-highlight">${escapeHtml(d.targetValue)}</span></div>
          </td>
          <td>
            <div class="source-api-tag" title="${escapeHtml(d.sourceApiUrl)}">⬅️ ${escapeHtml(sourceUrlShort)}</div>
            <div class="xpath-tag" style="color: #a78bfa;" title="${escapeHtml(d.sourceXPath)}">${escapeHtml(d.sourceXPath)}</div>
          </td>
        </tr>
      `;
    });

    return `
      <table class="dep-table">
        <thead>
          <tr>
            <th>Target Field (Request)</th>
            <th>Source Origin (Prior Response)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  /**
   * Formats XML string with indentation for clear reading.
   */
  function formatXmlOrRaw(xml) {
    if (!xml || typeof xml !== 'string') return '(empty)';
    const trimmed = xml.trim();
    if (!trimmed.startsWith('<')) return trimmed;

    try {
      let formatted = '';
      const reg = /(>)(<)(\/*)/g;
      const cleanXml = trimmed.replace(reg, '$1\r\n$2$3');
      let pad = 0;

      cleanXml.split('\r\n').forEach((node) => {
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
        formatted += padding + node + '\r\n';
        pad += indent;
      });

      return formatted.trim();
    } catch (e) {
      return trimmed;
    }
  }

  /**
   * Packages captured trace and triggers a JSON download.
   */
  function handleExportJSON() {
    if (computedLogsWithDependencies.length === 0) {
      alert('No API records available to export.');
      return;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      generator: 'EMS Nexacro XML Extension',
      totalRequests: computedLogsWithDependencies.length,
      chain: computedLogsWithDependencies.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        durationMs: entry.durationMs,
        clientType: entry.clientType,
        method: entry.method,
        url: entry.url,
        status: entry.status,
        statusText: entry.statusText,
        requestHeaders: entry.requestHeaders,
        requestBodyRaw: entry.requestBody,
        requestParsed: window.NexacroDependencyEngine
          ? window.NexacroDependencyEngine.parseNexacroXML(entry.requestBody)
          : null,
        responseHeaders: entry.responseHeaders,
        responseBodyRaw: entry.responseBody,
        responseParsed: window.NexacroDependencyEngine
          ? window.NexacroDependencyEngine.parseNexacroXML(entry.responseBody)
          : null,
        dependencies: entry.dependencies || []
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
   * Clears storage logs and resets UI.
   */
  function handleClearLogs() {
    if (!confirm('Clear all captured Nexacro API logs?')) return;
    chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
      currentLogs = [];
      computedLogsWithDependencies = [];
      chrome.action.setBadgeText({ text: '' });
      renderList();
    });
  }

  function handleFilterChange() {
    renderList();
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
})();