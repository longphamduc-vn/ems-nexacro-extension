# EMS Nexacro XML Interceptor & Dependency Engine

> A high-performance Chrome Extension (Manifest V3) designed to intercept, parse, and map cross-API data dependencies for EMS applications built on the **Nexacro Platform / XPlatform** XML communication protocol.

---

## 🚀 Key Features

1. **Full-Spectrum HTTP XML Interception**:
   - Hooks into the main execution context using `inject.js` to intercept both `window.fetch` and `XMLHttpRequest`.
   - Captures raw XML request payloads and response bodies without interfering with application workflows.

2. **Native Nexacro XML Architecture Parser**:
   - Parses `<Parameters>`, `<Dataset>`, `<ColumnInfo>`, and `<Rows>` using native `DOMParser`.
   - Correlates `<Col>` values to their respective `<Column>` schemas by index or ID.

3. **Automated XPath Generator**:
   - Generates exact, unambiguous XPath expressions for every element:
     - **Parameters**: `/{Root}/Parameters/Parameter[@id='KEY']`
     - **Dataset Columns**: `/{Root}/Dataset[@id='ds_name']/Rows/Row[1]/Col[@id='COL_ID']`

4. **API Dependency Detection Engine (`dependencyEngine.js`)**:
   - Automatically detects data lineage across chronological API chains.
   - Traces if values inside a subsequent API request payload originated from prior API responses.

5. **High-Performance UI for Large Traffic Volumes**:
   - **Lazy Drawer Rendering**: Card details (formatted XML, dataset tables, syntax highlighting) are constructed strictly on-demand upon clicking to expand, reducing initial DOM footprint by >90%.
   - **Virtual Batching & Infinite Scroll**: Cards load progressively in batches of 25 items for smooth scrolling.
   - **Full Paged Table Matrix**: Supports 25 / 50 / 100 rows per page with intuitive page navigation for silky smooth rendering of thousands of entries.
   - **Debounced Search**: Real-time filtering with 180ms debouncing.

6. **Comprehensive Multi-Format CSV & JSON Exporters**:
   - **📊 Export CSV: Dependencies Matrix**: Data lineage matrix compatible with Excel (UTF-8 BOM).
   - **📋 Export CSV: APIs Summary Table**: Full API execution log as a CSV spreadsheet.
   - **📤 Export CSV: Payloads Table**: Catalog of all request parameters and dataset rows across APIs.
   - **📥 Export CSV: Responses Table**: Catalog of all response parameters and dataset rows across APIs.
   - **🎯 Per-API Export**: Export individual API payload or response tables directly from each card.
   - **📦 Export Full JSON**: Exports the complete execution chain with raw and parsed trees.

---

## 📁 Directory Structure

```text
ems-nexacro-extension/
├── manifest.json         # Manifest V3 configuration & permissions
├── inject.js             # Main-world script hooking Fetch & XHR
├── content.js            # Bridge script injecting inject.js & handling storage (200-cap)
├── background.js         # Service worker managing extension lifecycle & badge count
├── dependencyEngine.js   # Nexacro XML parser & API dependency mapping engine
├── popup.html            # Extension popup user interface (Cards & Paged Table Matrix)
├── popup.js              # High-performance popup controller, lazy renderer & CSV/JSON exporters
└── README.md             # Documentation
```

---

## 🛠️ Installation Guide

1. Clone or download this repository:
   ```bash
   git clone https://github.com/longphamduc-vn/ems-nexacro-extension.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `ems-nexacro-extension` directory.
5. Open your EMS / Nexacro web application, execute actions, and open the extension popup to analyze API traffic and export tables as CSV or JSON.

---

## 📄 License

MIT License. Free for development and testing use.