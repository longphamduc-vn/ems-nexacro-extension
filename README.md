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

5. **Modern Inspector UI**:
   - Sleek ~500px x 550px popup with dark mode, badges, and real-time filtering.
   - Collapsible tabs for formatted Payload, Response, and a dedicated **Dependencies** view.
   - **📥 Export JSON**: Exports the full execution chain with computed dependencies in one click.
   - **🗑️ Clear Logs**: One-click cleanup of captured requests in `chrome.storage.local`.

---

## 📁 Directory Structure

```text
ems-nexacro-extension/
├── manifest.json         # Manifest V3 configuration & permissions
├── inject.js             # Main-world script hooking Fetch & XHR
├── content.js            # Bridge script injecting inject.js & handling storage
├── background.js         # Service worker managing extension lifecycle & badge count
├── dependencyEngine.js   # Nexacro XML parser & API dependency mapping engine
├── popup.html            # Extension popup user interface
├── popup.js              # Popup controller, UI renderer & JSON exporter
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
5. Open your EMS / Nexacro web application, execute actions, and open the extension popup to analyze API traffic and dependencies.

---

## 📄 License

MIT License. Free for development and testing use.