// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      0.0.10
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
#ca-file-input + button {
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
    const textCoords = `Tile X: ${coords.tile.x}, Tile Y: ${coords.tile.y} ; Pixel X: ${coords.pixel.x}, Pixel Y: ${coords.pixel.y}`;
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

  // dist/Template.js
  var Template = class {
    name;
    bitmap;
    constructor(name, bitmap) {
      this.name = name;
      this.bitmap = bitmap;
    }
    drawOnTile(ctx) {
      ctx.drawImage(this.bitmap, 0, 0);
    }
  };

  // dist/utils.js
  function parseCoordsFromPixelURL(url) {
    const urlSplitted = url.split("/");
    const last = urlSplitted[urlSplitted.length - 1];
    return {
      tile: {
        x: parseInt(urlSplitted[urlSplitted.length - 2]),
        y: parseInt(urlSplitted[urlSplitted.length - 1])
      },
      pixel: {
        x: parseInt(last.substring(last.indexOf("?") + 3)),
        y: parseInt(last.substring(last.indexOf("&") + 3))
      }
    };
  }
  function parseCoordsFromTileURL(url) {
    const urlSplitted = url.split("/");
    return {
      x: parseInt(urlSplitted[urlSplitted.length - 2] ?? ""),
      y: parseInt(urlSplitted[urlSplitted.length - 1] ?? "")
    };
  }
  function coordsToString(coords) {
    return `[${coords.x}, ${coords.y}]`;
  }
  function coordsToIndex(coords) {
    return coords.x * 2048 + coords.y;
  }

  // dist/Manager.js
  var ManagerClass = class {
    lastClickedCoords = null;
    templates;
    tilesInfo;
    constructor() {
      this.templates = [];
      this.tilesInfo = /* @__PURE__ */ new Map();
    }
    async createTemplate(file) {
      const bitmap = await createImageBitmap(file);
      const template = new Template(file.name, bitmap);
      this.templates.push(template);
      return template;
    }
    async processTile(coords, response) {
      const lastUpdated = new Date(response.headers.get("last-modified") ?? 0).getTime();
      const tileIndex = coordsToIndex(coords);
      let tileInfo;
      if (this.tilesInfo.has(tileIndex)) {
        tileInfo = this.tilesInfo.get(tileIndex);
        if (tileInfo.lastUpdated <= lastUpdated)
          return response;
        tileInfo.lastUpdated = lastUpdated;
      } else {
        tileInfo = {
          lastUpdated
        };
        this.tilesInfo.set(tileIndex, tileInfo);
      }
      const blob = await response.blob();
      const modifiedBlob = await this.drawOnTile(blob);
      return new Response(modifiedBlob, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
    }
    async drawOnTile(blob) {
      const canvas = new OffscreenCanvas(1e3, 1e3);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(await createImageBitmap(blob), 0, 0);
      for (const template of this.templates) {
        template.drawOnTile(ctx);
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
      document.getElementById("ca-input-tx").value = Manager.lastClickedCoords.tile.x.toString();
      document.getElementById("ca-input-ty").value = Manager.lastClickedCoords.tile.y.toString();
      document.getElementById("ca-input-px").value = Manager.lastClickedCoords.pixel.x.toString();
      document.getElementById("ca-input-py").value = Manager.lastClickedCoords.pixel.y.toString();
    });
    document.getElementById("ca-select-button").addEventListener("click", () => {
      document.getElementById("ca-file-input").click();
    });
    document.getElementById("ca-create-button").addEventListener("click", () => {
      const fileInput = document.getElementById("ca-file-input");
      if (fileInput.files.length < 1) {
        displayStatus("Select a file to upload");
        return;
      }
      Manager.createTemplate(fileInput.files[0]);
    });
  }

  // dist/app.js
  importFont();
  injectOverlay();
  addListeners();
  displayStatus("version " + GM_info.script.version);
  var originalFetch = unsafeWindow.fetch;
  unsafeWindow.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    const url = input instanceof Request ? input.url : input;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") && url.includes("/me")) {
      const json = await response.clone().json();
      if (json.status && json.status.toString()[0] !== "2") {
        displayStatus("Could not fetch user data, are you logged in?");
      } else {
        displayUserData(json);
      }
    } else if (contentType.includes("application/json") && url.includes("/pixel")) {
      const coords = parseCoordsFromPixelURL(url);
      Manager.lastClickedCoords = coords;
      displayTileCoords(coords);
    } else if (contentType.includes("image/") && url.includes("/tiles/")) {
      const coords = parseCoordsFromTileURL(url);
      const start = performance.now();
      const modified = await Manager.processTile(coords, response);
      const time = performance.now() - start;
      console.log("Processed tile" + coordsToString(coords) + " in " + time + "ms");
      return modified;
    }
    return response;
  };
  unsafeWindow.Manager = Manager;
})();
