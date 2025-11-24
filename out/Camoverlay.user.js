// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      0.2.0
// @description  A remake of Blue Marble
// @author       Sonyo
// @license      ISC
// @icon         https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg
// @source       https://github.com/Sonyo-UwU/Camoverlay
// @updateURL    https://github.com/Sonyo-UwU/Camoverlay/raw/refs/heads/main/out/Camoverlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonyo-UwU/Camoverlay/main/out/Camoverlay.user.js
// @match        https://wplace.live/*
// @run-at       document-body
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

"use strict";
(() => {
  // dist/display.js
  function injectOverlay() {
    document.body.appendChild(document.createElement("div")).outerHTML = `
<div id="ca-overlay">
    <div id="ca-header">
        <img src="https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg" />
        <h1>Camoverlay</h1>
    </div>
    <hr />
    <div>
        <p>Username: <b id="ca-user-name"></b></p>
        <p>Droplets: <b id="ca-user-droplets"></b></p>
        <p>Next level in: <b id="ca-user-level">...</b> pixels</p>
    </div>
    <hr />
    <div id="ca-automation">
        <div id="ca-coords">
            <button id="ca-coords-button" class="ca-icon-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 6">
                    <circle cx="2" cy="2" r="2"></circle>
                    <path d="M2 6 L3.7 3 L0.3 3 Z"></path>
                    <circle cx="2" cy="2" r="0.7" fill="white"></circle>
                </svg>
            </button><input id="ca-input-tx" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl X" /><input id="ca-input-ty" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl Y" /><input id="ca-input-px" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px X" /><input id="ca-input-py" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px Y" />
        </div>
        <div id="ca-templates">
            <div>
                <input id="ca-file-input" type="file" accept="image/png, image/jpeg, image/webp, image/bmp, image/gif" />
                <button id="ca-select-button">Select file</button>
            </div>
            <div id="ca-template-buttons">
                <button id="ca-enable-button">Enable</button>
                <button id="ca-create-button">Create</button>
                <button id="ca-disable-button">Disable</button>
            </div>
        </div>
        <textarea id="ca-output" readonly placeholder="Sleeping"></textarea>
        <div id="ca-bottom">
            <div>
                <button class="ca-icon-button">🎨</button><button class="ca-icon-button">🌐</button>
            </div>
            <small>
                Made by Sonyo
                <br>
                Original by SwingTheVine
                <br>
                Art by <a href="https://camomille1411en.carrd.co/" target="_blank">camomille1411</a>
            </small>
        </div>
    </div>
</div>
`;
    GM_addStyle(`
#ca-overlay {
    background-color: #5D1F18E6;
    border-radius: 8px;
    color: white;
    max-width: 300px;
    padding: 10px;
    position: absolute;
    right: 75px;
    top: 10px;
    width: auto;
    z-index: 29;
}

div#ca-overlay {
    /* Font stack is as follows:
   * Highest Priority (Roboto Mono)
   * Windows fallback (Courier New)
   * macOS fallback (Monaco)
   * Linux fallback (DejaVu Sans Mono)
   * Any possible monospace font (monospace)
   * Last resort (Arial) */
    font-family: 'Roboto Mono', 'Courier New', 'Monaco', 'DejaVu Sans Mono', monospace, 'Arial';
    letter-spacing: 0.05em;
}

#ca-overlay h1 {
    display: inline-block;
    font-size: x-large;
    font-weight: bold;
    vertical-align: middle;
}

#ca-overlay hr {
    margin: 0.5em 0;
}

#ca-overlay small {
    font-size: x-small;
    color: lightgray;
    margin-top: 0;
    text-align: right;
}

#ca-header img {
    border-radius: 12px;
    display: inline-block;
    height: 2.5em;
    margin-right: 1ch;
    vertical-align: middle;
}

#ca-overlay button {
    background-color: #cb4334;
    border-radius: 1em;
    padding: 0 0.75ch;
}
#ca-overlay button:hover, #ca-overlay button:focus-visible {
    background-color: #d16458;
}
#ca-overlay button:active, #ca-overlay button:disabled {
    background-color: #d68d85;
}
#ca-overlay button:disabled {
    text-decoration: line-through;
}

#ca-templates > * {
    margin-top: 0.5em;
}

#ca-file-input {
    display: none !important;
}
#ca-select-button {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#ca-template-buttons {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    align-items: center;
    gap: 1ch;
}

#ca-output {
    font-size: small;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    margin-top: 0.5em;
    height: 7.5em;
    width: 100%;
}

#ca-bottom {
    display: flex;
    justify-content: space-between;
}

.ca-icon-button {
    border: white 1px solid;
    height: 1.5em;
    width: 1.5em;
    padding: 0 !important; /* Overrides the padding in "#ca-overlay button" */
    line-height: 1em;
    text-align: center;
    vertical-align: middle;
}
.ca-icon-button svg {
    width: 50%;
    margin: 0 auto;
    fill: #111;
}

.ca-coords-input {
    appearance: auto;
    -moz-appearance: textfield;
    width: 5.5ch;
    margin-left: 1ch;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    font-size: small;
}
.ca-coords-input::-webkit-outer-spin-button,
.ca-coords-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
`);
  }
  function importFont() {
    const stylesheetLink = document.createElement("link");
    stylesheetLink.href = "https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap";
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.as = "style";
    document.head.appendChild(stylesheetLink);
  }
  function displayStatus(message) {
    const textArea = document.getElementById("ca-output");
    if (textArea !== null)
      textArea.value = message;
  }
  function displayUserData(data) {
    const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), 1 / 0.65) - data.pixelsPainted);
    const username = document.getElementById("ca-user-name");
    if (username !== null) {
      username.innerText = data.name;
      document.getElementById("ca-user-droplets").innerText = data.droplets.toLocaleString();
      document.getElementById("ca-user-level").innerText = nextLevelPixels.toLocaleString();
    }
  }
  function displayTileCoords(coords) {
    const textCoords = `Tile X: ${coords.tx}, Tile Y: ${coords.ty} ; Pixel X: ${coords.px}, Pixel Y: ${coords.py}`;
    const displayCoords = document.getElementById("ca-display-coords");
    if (displayCoords !== null) {
      displayCoords.textContent = textCoords;
    } else {
      const div = document.getElementsByClassName("text-base-content/80 mt-1 px-3 text-sm")[0];
      if (div !== void 0) {
        const span = document.createElement("span");
        span.id = "ca-display-coords";
        span.textContent = textCoords;
        span.style.paddingInline = "calc(var(--spacing)*3)";
        span.style.fontSize = "small";
        div.insertAdjacentElement("beforebegin", span);
      }
    }
  }
  function setPixelCoords(coords) {
    document.getElementById("ca-input-tx").value = coords.tx.toString();
    document.getElementById("ca-input-ty").value = coords.ty.toString();
    document.getElementById("ca-input-px").value = coords.px.toString();
    document.getElementById("ca-input-py").value = coords.py.toString();
  }

  // dist/Coords.js
  var TileCoords = class _TileCoords {
    x;
    y;
    constructor(x, y) {
      this.x = x % 2048;
      this.y = y % 2048;
    }
    static toIndex(x, y) {
      return x * 1e4 + y;
    }
    toIndex() {
      return _TileCoords.toIndex(this.x, this.y);
    }
    toString() {
      return `[${this.x}, ${this.y}]`;
    }
  };
  var PixelCoords = class _PixelCoords {
    tx;
    ty;
    px;
    py;
    constructor(tx, ty, px, py) {
      this.tx = (tx + Math.floor(px / 1e3)) % 2048;
      this.ty = (ty + Math.floor(py / 1e3)) % 2048;
      this.px = px % 1e3;
      this.py = py % 1e3;
    }
    static copy(o) {
      return new _PixelCoords(o.tx, o.ty, o.px, o.py);
    }
    toString() {
      return `[${this.tx}, ${this.ty} ; ${this.px}, ${this.py}]`;
    }
  };

  // dist/Template.js
  var Template = class _Template {
    name;
    coords;
    overlappedTiles;
    bitmap;
    constructor(name, coords) {
      this.name = name;
      this.coords = coords;
      this.overlappedTiles = [];
      this.bitmap = null;
    }
    static async fromFile(name, coords, file) {
      const template = new _Template(name, coords);
      const bitmap = await createImageBitmap(file);
      const end = new PixelCoords(coords.tx, coords.ty, coords.px + bitmap.width, coords.py + bitmap.height);
      for (let i = template.coords.tx; i <= end.tx; i++)
        for (let j = template.coords.ty; j <= end.ty; j++)
          template.overlappedTiles.push(TileCoords.toIndex(i, j));
      const canvas = new OffscreenCanvas(Manager.patternSize * bitmap.width, Manager.patternSize * bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < imageData.height; y++)
        for (let x = 0; x < imageData.width; x++) {
          const pixelIndex = (y * imageData.width + x) * 4;
          if (x % Manager.patternSize !== 1 || y % Manager.patternSize !== 1)
            imageData.data[pixelIndex + 3] = 0;
        }
      ctx.putImageData(imageData, 0, 0);
      template.bitmap = canvas.transferToImageBitmap();
      return template;
    }
    overlaps(tile) {
      return this.overlappedTiles.includes(tile);
    }
    drawOnTile(tile, ctx) {
      if (this.bitmap === null || !this.overlaps(tile.toIndex()))
        return;
      ctx.drawImage(this.bitmap, (this.coords.tx * 1e3 + this.coords.px - tile.x * 1e3) * Manager.patternSize, (this.coords.ty * 1e3 + this.coords.py - tile.y * 1e3) * Manager.patternSize);
    }
  };

  // dist/Manager.js
  var ManagerClass = class _ManagerClass {
    lastClickedCoords = null;
    #inputCoords = null;
    set inputCoords(value) {
      this.#inputCoords = value;
      this.storeGlobal();
    }
    get inputCoords() {
      return this.#inputCoords;
    }
    templates;
    tilesInfo;
    patternSize = 3;
    constructor() {
      this.templates = [];
      this.tilesInfo = /* @__PURE__ */ new Map();
    }
    static #loadValue(key) {
      return JSON.parse(GM_getValue(key, null));
    }
    static #storeValue(key, value) {
      GM_setValue(key, JSON.stringify(value));
    }
    loadGlobals() {
      const stored = _ManagerClass.#loadValue("global");
      if (stored && stored.inputCoords) {
        this.#inputCoords = PixelCoords.copy(stored.inputCoords);
        this.lastClickedCoords = this.#inputCoords;
        setPixelCoords(this.lastClickedCoords);
      }
    }
    storeGlobal() {
      _ManagerClass.#storeValue("global", {
        inputCoords: this.inputCoords
      });
    }
    async createTemplate(coords, file) {
      const start = performance.now();
      const template = await Template.fromFile(file.name, coords, file);
      const time = performance.now() - start;
      console.log("Created template in " + time + "ms");
      for (const index of template.overlappedTiles) {
        this.tilesInfo.delete(index);
      }
      this.templates = [template];
      return template;
    }
    async processTile(tile, response) {
      const lastModified = new Date(response.headers.get("last-modified") ?? 0).getTime();
      const tileIndex = tile.toIndex();
      let overlap = false;
      for (const template of this.templates) {
        if (template.overlaps(tileIndex)) {
          overlap = true;
          break;
        }
      }
      if (!overlap)
        return response;
      let tileInfo;
      if (this.tilesInfo.has(tileIndex)) {
        tileInfo = this.tilesInfo.get(tileIndex);
      } else {
        tileInfo = {
          lastModified: 0,
          blob: null
        };
        this.tilesInfo.set(tileIndex, tileInfo);
      }
      if (tileInfo.blob === null || tileInfo.lastModified < lastModified) {
        const blob = await response.blob();
        const modifiedBlob = await this.drawOnTile(tile, blob);
        tileInfo.blob = modifiedBlob;
        tileInfo.lastModified = lastModified;
      }
      return new Response(tileInfo.blob, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
    }
    async drawOnTile(tile, blob) {
      const canvas = new OffscreenCanvas(this.patternSize * 1e3, this.patternSize * 1e3);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);
      for (const template of this.templates) {
        template.drawOnTile(tile, ctx);
      }
      return await canvas.convertToBlob();
    }
  };
  var Manager = new ManagerClass();

  // dist/eventListeners.js
  function addListeners() {
    document.getElementById("ca-coords-button").addEventListener("click", () => {
      if (Manager.lastClickedCoords === null) {
        displayStatus("Click on the canvas first to pick coordinates");
        return;
      }
      setPixelCoords(Manager.lastClickedCoords);
      Manager.inputCoords = Manager.lastClickedCoords;
    });
    document.getElementById("ca-select-button").addEventListener("click", () => {
      document.getElementById("ca-file-input").click();
    });
    document.getElementById("ca-file-input").addEventListener("change", (e) => {
      if (e.target.files.length > 0)
        document.getElementById("ca-select-button").innerText = e.target.files[0].name;
    });
    document.getElementById("ca-create-button").addEventListener("click", () => {
      const fileInput = document.getElementById("ca-file-input");
      if (fileInput.files.length < 1) {
        displayStatus("Select a file to upload");
        return;
      }
      const tx = parseInt(document.getElementById("ca-input-tx").value);
      const ty = parseInt(document.getElementById("ca-input-ty").value);
      const px = parseInt(document.getElementById("ca-input-px").value);
      const py = parseInt(document.getElementById("ca-input-py").value);
      if (isNaN(tx) || isNaN(ty) || isNaN(px) || isNaN(py)) {
        displayStatus("Invalid coordonates");
        return;
      }
      const coords = new PixelCoords(tx, ty, px, py);
      Manager.createTemplate(coords, fileInput.files[0]);
      displayStatus("Created template at " + coords.toString());
    });
  }

  // dist/utils.js
  function parsePixelCoordsFromURL(url) {
    const urlSplitted = url.split("/");
    const last = urlSplitted[urlSplitted.length - 1];
    return new PixelCoords(parseInt(urlSplitted[urlSplitted.length - 2]), parseInt(urlSplitted[urlSplitted.length - 1]), parseInt(last.substring(last.indexOf("?") + 3)), parseInt(last.substring(last.indexOf("&") + 3)));
  }
  function parseTileCoordsFromURL(url) {
    const urlSplitted = url.split("/");
    return new TileCoords(parseInt(urlSplitted[urlSplitted.length - 2] ?? ""), parseInt(urlSplitted[urlSplitted.length - 1] ?? ""));
  }

  // dist/app.js
  importFont();
  injectOverlay();
  addListeners();
  Manager.loadGlobals();
  displayStatus("version " + GM_info.script.version);
  var originalFetch = unsafeWindow.fetch;
  unsafeWindow.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    const url = input instanceof Request ? input.url : input;
    const contentType = response.headers.get("content-type") ?? "";
    const method = init?.method ?? "GET";
    if (contentType.includes("application/json") && url.includes("/me") && method === "GET") {
      const json = await response.clone().json();
      if (json.status && json.status.toString()[0] !== "2") {
        displayStatus("Could not fetch user data, are you logged in?");
      } else {
        displayUserData(json);
      }
    } else if (contentType.includes("application/json") && url.includes("/pixel")) {
      if (method === "GET") {
        const coords = parsePixelCoordsFromURL(url);
        Manager.lastClickedCoords = coords;
        displayTileCoords(coords);
      } else if (method === "POST") {
        const coords = parseTileCoordsFromURL(url);
        Manager.tilesInfo.delete(coords.toIndex());
      }
    } else if (contentType.includes("image/") && url.includes("/tiles/") && method === "GET") {
      const coords = parseTileCoordsFromURL(url);
      const start = performance.now();
      const modified = await Manager.processTile(coords, response);
      const time = performance.now() - start;
      console.log("Processed tile" + coords.toString() + " in " + time + "ms");
      return modified;
    }
    return response;
  };
  unsafeWindow.Manager = Manager;
})();
