// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      0.5.14
// @description  A remake of Blue Marble
// @author       Sonyo
// @license      ISC
// @icon         https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg
// @source       https://github.com/Sonyo-UwU/Camoverlay
// @updateURL    https://github.com/Sonyo-UwU/Camoverlay/raw/refs/heads/main/out/Camoverlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonyo-UwU/Camoverlay/main/out/Camoverlay.user.js
// @match        https://wplace.live/*
// @run-at       document-body
// @require      https://cdn.jsdelivr.net/gh/pieroxy/lz-string/libs/lz-string.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==


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
function twoHexDigits(n) {
  return n < 16 ? "0" + n.toString(16) : n.toString(16);
}
function closeEnough(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db <= 100;
}
function rgbToId(r, g, b) {
  return r * 1e3 * 1e3 + g * 1e3 + b;
}
function rgbToCss(rgb) {
  return twoHexDigits(rgb[0]) + twoHexDigits(rgb[1]) + twoHexDigits(rgb[2]);
}
var otherColor = { id: rgbToId(136, 136, 136), name: "Other", rgb: [136, 136, 136] };
function getClosestColor(r, g, b) {
  const id = rgbToId(r, g, b);
  const color = rgbColorMap.get(id);
  if (color !== void 0)
    return color;
  for (const color2 of rgbColorMap.values()) {
    if (closeEnough(r, g, b, ...color2.rgb))
      return color2;
  }
  return otherColor;
}
function getColor(r, g, b) {
  const id = rgbToId(r, g, b);
  const color = rgbColorMap.get(id);
  if (color !== void 0)
    return color;
  return otherColor;
}
var colorPalette = [
  { name: "Transparent", rgb: [222, 250, 206] },
  { name: "Black", rgb: [0, 0, 0] },
  { name: "Dark Gray", rgb: [60, 60, 60] },
  { name: "Gray", rgb: [120, 120, 120] },
  { name: "Light Gray", rgb: [210, 210, 210] },
  { name: "White", rgb: [255, 255, 255] },
  { name: "Deep Red", rgb: [96, 0, 24] },
  { name: "Red", rgb: [237, 28, 36] },
  { name: "Orange", rgb: [255, 127, 39] },
  { name: "Gold", rgb: [246, 170, 9] },
  { name: "Yellow", rgb: [249, 221, 59] },
  { name: "Light Yellow", rgb: [255, 250, 188] },
  { name: "Dark Green", rgb: [14, 185, 104] },
  { name: "Green", rgb: [19, 230, 123] },
  { name: "Light Green", rgb: [135, 255, 94] },
  { name: "Dark Teal", rgb: [12, 129, 110] },
  { name: "Teal", rgb: [16, 174, 166] },
  { name: "Light Teal", rgb: [19, 225, 190] },
  { name: "Dark Blue", rgb: [40, 80, 158] },
  { name: "Blue", rgb: [64, 147, 228] },
  { name: "Cyan", rgb: [96, 247, 242] },
  { name: "Indigo", rgb: [107, 80, 246] },
  { name: "Light Indigo", rgb: [153, 177, 251] },
  { name: "Dark Purple", rgb: [120, 12, 153] },
  { name: "Purple", rgb: [170, 56, 185] },
  { name: "Light Purple", rgb: [224, 159, 249] },
  { name: "Dark Pink", rgb: [203, 0, 122] },
  { name: "Pink", rgb: [236, 31, 128] },
  { name: "Light Pink", rgb: [243, 141, 169] },
  { name: "Dark Brown", rgb: [104, 70, 52] },
  { name: "Brown", rgb: [149, 104, 42] },
  { name: "Beige", rgb: [248, 178, 119] },
  { name: "Medium Gray", rgb: [170, 170, 170] },
  { name: "Dark Red", rgb: [165, 14, 30] },
  { name: "Light Red", rgb: [250, 128, 114] },
  { name: "Dark Orange", rgb: [228, 92, 26] },
  { name: "Light Tan", rgb: [214, 181, 148] },
  { name: "Dark Goldenrod", rgb: [156, 132, 49] },
  { name: "Goldenrod", rgb: [197, 173, 49] },
  { name: "Light Goldenrod", rgb: [232, 212, 95] },
  { name: "Dark Olive", rgb: [74, 107, 58] },
  { name: "Olive", rgb: [90, 148, 74] },
  { name: "Light Olive", rgb: [132, 197, 115] },
  { name: "Dark Cyan", rgb: [15, 121, 159] },
  { name: "Light Cyan", rgb: [187, 250, 242] },
  { name: "Light Blue", rgb: [125, 199, 255] },
  { name: "Dark Indigo", rgb: [77, 49, 184] },
  { name: "Dark Slate Blue", rgb: [74, 66, 132] },
  { name: "Slate Blue", rgb: [122, 113, 196] },
  { name: "Light Slate Blue", rgb: [181, 174, 241] },
  { name: "Light Brown", rgb: [219, 164, 99] },
  { name: "Dark Beige", rgb: [209, 128, 81] },
  { name: "Light Beige", rgb: [255, 197, 165] },
  { name: "Dark Peach", rgb: [155, 82, 73] },
  { name: "Peach", rgb: [209, 128, 120] },
  { name: "Light Peach", rgb: [250, 182, 164] },
  { name: "Dark Tan", rgb: [123, 99, 82] },
  { name: "Tan", rgb: [156, 132, 107] },
  { name: "Dark Slate", rgb: [51, 57, 65] },
  { name: "Slate", rgb: [109, 117, 141] },
  { name: "Light Slate", rgb: [179, 185, 209] },
  { name: "Dark Stone", rgb: [109, 100, 63] },
  { name: "Stone", rgb: [148, 140, 107] },
  { name: "Light Stone", rgb: [205, 197, 158] }
];
var rgbColorMap = /* @__PURE__ */ new Map();
for (const color of colorPalette) {
  rgbColorMap.set(rgbToId(...color.rgb), { ...color, id: rgbToId(...color.rgb) });
}

// dist/Template.js
var Template = class _Template {
  name;
  coords;
  overlappedTiles;
  imageData;
  width;
  height;
  base64Data;
  colorsInfo;
  totalPixelCount;
  enabled;
  constructor(name, coords, width, height) {
    this.name = name;
    this.coords = coords;
    this.overlappedTiles = [];
    this.imageData = null;
    this.width = width;
    this.height = height;
    this.base64Data = "";
    this.colorsInfo = /* @__PURE__ */ new Map();
    this.totalPixelCount = 0;
    this.enabled = true;
  }
  static async fromFile(name, coords, file) {
    const bitmap = await createImageBitmap(file);
    const template = new _Template(name, coords, bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < imageData.height; y++)
      for (let x = 0; x < imageData.width; x++) {
        const pixelIndex = (y * imageData.width + x) * 4;
        const color = getClosestColor(imageData.data[pixelIndex + 0], imageData.data[pixelIndex + 1], imageData.data[pixelIndex + 2]);
        template.colorsInfo.set(color.id, (template.colorsInfo.get(color.id) ?? 0) + 1);
        template.totalPixelCount++;
        if (color !== otherColor) {
          imageData.data[pixelIndex + 0] = color.rgb[0];
          imageData.data[pixelIndex + 1] = color.rgb[1];
          imageData.data[pixelIndex + 2] = color.rgb[2];
        }
      }
    ctx.putImageData(imageData, 0, 0);
    template.imageData = imageData.data;
    let binary = "";
    for (let i = 0; i < template.imageData.length; i++) {
      binary += String.fromCharCode(template.imageData[i]);
    }
    template.base64Data = LZString.compress(btoa(binary));
    template.#computeOverlappedTiles();
    return template;
  }
  static async fromStorage(stored) {
    const template = new _Template(stored.name, PixelCoords.copy(stored.coords), stored.width, stored.height);
    const binary = atob(LZString.decompress(stored.base64Data));
    const array = new Uint8ClampedArray(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    template.imageData = array;
    template.base64Data = stored.base64Data;
    template.totalPixelCount = stored.totalPixelCount;
    template.colorsInfo = new Map(stored.colorsInfo);
    template.#computeOverlappedTiles();
    return template;
  }
  overlaps(tile) {
    return this.overlappedTiles.includes(tile);
  }
  drawOnTile(tile, ctx) {
    if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
      return;
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const startX = (this.coords.tx - tile.x) * 1e3;
    const endX = Math.min(startX + this.width, 1e3);
    const startY = (this.coords.ty - tile.y) * 1e3;
    const endY = Math.min(startY + this.height, 1e3);
    for (let y = startY; y < endY; y++)
      for (let x = startX; x < endX; x++) {
        const imagePixelIndex = (y * this.width + x) * 4;
        const canvasPixelIndex = (((y + this.coords.py) * Manager.patternSize + 1) * ctx.canvas.width + (x + this.coords.px) * Manager.patternSize + 1) * 4;
        if (this.imageData[imagePixelIndex + 3] === 0)
          continue;
        const color = getColor(this.imageData[imagePixelIndex + 0], this.imageData[imagePixelIndex + 1], this.imageData[imagePixelIndex + 2]);
        if (Manager.enabledColors.get(color.id)) {
          imageData.data[canvasPixelIndex + 0] = this.imageData[imagePixelIndex + 0];
          imageData.data[canvasPixelIndex + 1] = this.imageData[imagePixelIndex + 1];
          imageData.data[canvasPixelIndex + 2] = this.imageData[imagePixelIndex + 2];
          imageData.data[canvasPixelIndex + 3] = this.imageData[imagePixelIndex + 3];
        }
      }
    ctx.putImageData(imageData, 0, 0);
  }
  toJSON(_) {
    return {
      name: this.name,
      coords: this.coords,
      width: this.width,
      height: this.height,
      totalPixelCount: this.totalPixelCount,
      colorsInfo: this.colorsInfo.entries().toArray(),
      base64Data: this.base64Data,
      enabled: this.enabled
    };
  }
  #computeOverlappedTiles() {
    this.overlappedTiles = [];
    const end = new PixelCoords(this.coords.tx, this.coords.ty, this.coords.px + this.width, this.coords.py + this.height);
    for (let i = this.coords.tx; i <= end.tx; i++)
      for (let j = this.coords.ty; j <= end.ty; j++)
        this.overlappedTiles.push(TileCoords.toIndex(i, j));
  }
};

// dist/Manager.js
var ManagerClass = class _ManagerClass {
  patternSize = 3;
  templates;
  tilesInfo;
  enabledColors;
  lastClickedCoords;
  setInputCoords(value) {
    document.getElementById("ca-input-tx").value = value?.tx.toString() ?? "";
    document.getElementById("ca-input-ty").value = value?.ty.toString() ?? "";
    document.getElementById("ca-input-px").value = value?.px.toString() ?? "";
    document.getElementById("ca-input-py").value = value?.py.toString() ?? "";
    this.storeGlobal({ inputCoords: value });
  }
  getInputCoords() {
    const tx = parseInt(document.getElementById("ca-input-tx").value);
    const ty = parseInt(document.getElementById("ca-input-ty").value);
    const px = parseInt(document.getElementById("ca-input-px").value);
    const py = parseInt(document.getElementById("ca-input-py").value);
    if (isNaN(tx) || isNaN(ty) || isNaN(px) || isNaN(py)) {
      return null;
    }
    return new PixelCoords(tx, ty, px, py);
  }
  constructor() {
    this.templates = [];
    this.tilesInfo = /* @__PURE__ */ new Map();
    this.enabledColors = /* @__PURE__ */ new Map();
    this.lastClickedCoords = null;
  }
  static #loadValue(key) {
    return JSON.parse(GM_getValue(key, null));
  }
  static #storeValue(key, value) {
    GM_setValue(key, JSON.stringify(value));
  }
  loadGlobals() {
    const stored = _ManagerClass.#loadValue("global");
    if (stored === null)
      return;
    if (stored.inputCoords) {
      this.lastClickedCoords = PixelCoords.copy(stored.inputCoords);
      this.setInputCoords(this.lastClickedCoords);
    }
    this.enabledColors = new Map(stored.enabledColors);
  }
  storeGlobal(overrides) {
    _ManagerClass.#storeValue("global", {
      inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
      enabledColors: this.enabledColors.entries().toArray()
    });
  }
  async loadTemplates() {
    const stored = _ManagerClass.#loadValue("templates");
    if (!stored)
      return;
    while (this.templates.length > 0)
      this.deleteTemplate(0);
    for (const storedTemplate of stored) {
      const template = await Template.fromStorage(storedTemplate);
      this.resetTiles(template.overlappedTiles);
      this.templates.push(template);
      addTemplateRow(template);
    }
    this.rebuildColorList();
    displayStatus("Loaded " + this.templates.length + " templates");
  }
  storeTemplates() {
    _ManagerClass.#storeValue("templates", this.templates);
  }
  resetTiles(indices) {
    for (const index of indices)
      this.tilesInfo.delete(index);
  }
  async createTemplate(coords, file) {
    let name = file.name.slice(0, file.name.lastIndexOf("."));
    if (name.startsWith("converted_"))
      name = name.substring(10);
    for (let i = 0; i < this.templates.length; i++)
      if (this.templates[i].name === name) {
        this.deleteTemplate(i);
        i--;
      }
    const start = performance.now();
    const template = await Template.fromFile(name, coords, file);
    const time = performance.now() - start;
    console.log("Created template in " + time + "ms");
    this.resetTiles(template.overlappedTiles);
    this.templates.push(template);
    this.storeTemplates();
    addTemplateRow(template);
    this.rebuildColorList();
    displayStatus("Created template at " + template.coords.toString() + ": " + template.totalPixelCount + " pixels");
    return template;
  }
  deleteTemplate(index) {
    const template = this.templates[index];
    if (template === void 0)
      return;
    this.resetTiles(template.overlappedTiles);
    this.templates.splice(index, 1);
    this.storeTemplates();
    removeTemplateRow(template.name);
    this.rebuildColorList();
  }
  rebuildColorList() {
    const list = document.getElementById("ca-color-list");
    while (list.firstChild)
      list.firstChild.remove();
    const colorCounts = /* @__PURE__ */ new Map();
    for (const template of this.templates) {
      if (template.enabled)
        for (const [id, count] of template.colorsInfo)
          colorCounts.set(id, (colorCounts.get(id) ?? 0) + count);
    }
    for (const id of this.enabledColors.keys()) {
      if (!colorCounts.has(id))
        this.enabledColors.delete(id);
    }
    for (const [id, count] of colorCounts.entries().toArray().sort((a, b) => b[1] - a[1])) {
      addColorRow(id, count, this.enabledColors.get(id) ?? true);
    }
  }
  async processTile(tile, response) {
    const lastModified = new Date(response.headers.get("last-modified") ?? 0).getTime();
    const tileIndex = tile.toIndex();
    let overlap = false;
    for (const template of this.templates) {
      if (template.enabled && template.overlaps(tileIndex)) {
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
    let allDisabled = true;
    for (const enabled of Manager.enabledColors.values()) {
      if (enabled) {
        allDisabled = false;
        break;
      }
    }
    if (allDisabled)
      return blob;
    const canvas = new OffscreenCanvas(this.patternSize * 1e3, this.patternSize * 1e3);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);
    for (const template of this.templates) {
      if (template.enabled)
        template.drawOnTile(tile, ctx);
    }
    return await canvas.convertToBlob();
  }
};
var Manager = new ManagerClass();

// dist/display.js
function injectOverlay() {
  document.body.appendChild(document.createElement("div")).outerHTML = `<div id="ca-overlay"><template id="ca-color-template"><div class="ca-color-row"><input type="checkbox" /><div class="ca-color-display"></div><button class="ca-icon-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm230-240L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Z"></path></svg></button><span class="ca-color-count"></span><span> • </span><span class="ca-color-name"></span></div></template><template id="ca-template-template"><div class="ca-template-row"><button class="ca-icon-button ca-template-fly" disabled>✈️</button><div><span class="ca-pixel-count"></span><span> • </span><span class="ca-template-name"></span></div><div><input type="checkbox" /><button class="ca-icon-button ca-template-delete">🗑️</button></div></div></template><div id="ca-header"><img id="ca-image-collapse" src="https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg" /><h1>Camoverlay</h1></div><hr /><div><p>Username: <b id="ca-user-name"></b></p><p>Droplets: <b id="ca-user-droplets"></b></p><p>Level <b id="ca-user-level">0</b> in <b id="ca-user-pixels">0</b> pixels</p></div><hr /><div id="ca-automation"><div id="ca-coords"><button id="ca-coords-button" class="ca-icon-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 6"><circle cx="2" cy="2" r="2"></circle><path d="M2 6 L3.7 3 L0.3 3 Z"></path><circle cx="2" cy="2" r="0.7" fill="white"></circle></svg></button><input id="ca-input-tx" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl X" /><input id="ca-input-ty" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl Y" /><input id="ca-input-px" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px X" /><input id="ca-input-py" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px Y" /><button id="ca-copy-coords-button" class="ca-icon-button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11 7h6v6h-6z" /><path d="M6.5 3h8.1c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v7.1M6.2 21h8.1c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874c.218-.428.218-.988.218-2.108V9.7c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C15.98 6.5 15.42 6.5 14.3 6.5H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 8.02 3 8.58 3 9.7v8.1c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button></div><div id="ca-color-list"></div><div id="ca-templates"><div id="ca-template-buttons"><input id="ca-file-input" type="file" accept="image/png" /><button id="ca-select-button">Select file</button><button id="ca-create-button">Create</button></div><div id="ca-template-list"></div></div><textarea id="ca-output" readonly placeholder="Sleeping"></textarea><div id="ca-bottom"><div><button id="ca-converter-button" class="ca-icon-button">🎨</button></div><small><span>Made by Sonyo<br>Original by SwingTheVine<br>Art by <a href="https://camomille1411en.carrd.co/" target="_blank">camomille1411</a><br></span><span id="ca-version"></span></small></div></div></div>`;
  GM_addStyle(`
#ca-overlay {
    background-color: #5D1F18E6;
    border-radius: 8px;
    color: white;
    max-height: 100%;
    max-width: 300px;
    overflow: hidden;
    padding: 10px;
    position: absolute;
    right: 75px;
    top: 10px;
    transition-duration: 500ms;
    transition-property: max-height, max-width;
    width: auto;
    white-space: nowrap;
    z-index: 29;
}

/* Collapsing */
#ca-overlay.collapsed {
    max-width: 60px;
    max-height: 60px;
}

#ca-overlay > :not(#ca-header), #ca-overlay h1 {
    opacity: 1;
    transition-property: opacity;
    transition-duration: 500ms;
}
#ca-overlay.collapsed > :not(#ca-header), #ca-overlay.collapsed h1 {
    opacity: 0;
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

#ca-overlay button {
    background-color: #cb4334;
    border-radius: 1em;
    padding: 0 0.75ch;
}
#ca-overlay button:hover, #ca-overlay button:focus-visible {
    background-color: #d16458;
}
#ca-overlay button:active {
    background-color: #d68d85;
}
#ca-overlay button:disabled {
    background-color: #d68d85;
    cursor: not-allowed;
}

#ca-image-collapse {
    border-radius: 12px;
    cursor: pointer;
    display: inline-block;
    height: 2.5em;
    margin-right: 1ch;
    vertical-align: middle;
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

#ca-coords {
    display: flex;
    justify-content: space-between;
}

.ca-coords-input {
    appearance: auto;
    -moz-appearance: textfield;
    width: 5.5ch;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    font-size: small;
}
.ca-coords-input::-webkit-outer-spin-button,
.ca-coords-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

#ca-copy-coords-button > svg {
    width: 70%;
    transition-property: fill;
    transition-duration: 250ms;
}

#ca-color-list {
    background-color: #00000022;
    border-color: black;
    border-radius: .3em;
    border-width: 1px;
    font-size: 75%;
    margin-top: 0.5em;
    max-height: 120px;
    overflow: auto;
    padding: 5px;
}
#ca-color-list:empty {
    display: none;
}
.ca-color-row {
    align-content: center;
    align-items: center;
    display: flex;
    flex-direction: row;
    gap: 1ch;
    justify-content: start;
}
.ca-color-row > * {
    flex: 0 0 auto;
}
.ca-color-row > input {
    filter: hue-rotate(130deg);
}
.ca-color-display {
    border-color: #FFF8;
    border-radius: 0.3em;
    border-width: 1px;
    cursor: pointer;
    height: 1.2em;
    width: 1.2em;
}
.ca-color-row > button {
    height: 1.3em;
    width: 1.3em;
}
.ca-color-row > button > svg {
    width: 80%;
}
.ca-color-name {
    flex: unset;
    overflow: hidden;
    text-overflow: ellipsis;
}

#ca-templates > * {
    margin-top: 0.5em;
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

#ca-file-input {
    display: none !important;
}
#ca-select-button {
    flex: 1 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

#ca-create-button {
    flex: 0 0;
}

#ca-template-list {
    font-size: 80%;
}
#ca-template-list:empty {
    display: none;
}
.ca-template-row {
    display: flex;
    justify-content: space-between;
    background-color: #FF000033;
    border-radius: 1em;
    gap: 1ch;
    margin-bottom: 3px;
}
.ca-template-row > * {
    flex: 0 0 auto;
}
.ca-template-row > *:nth-child(2) {
    flex: unset;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ca-template-row input {
    vertical-align: middle;
    margin-right: 0.5ch;
    filter: hue-rotate(70deg);
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
    document.getElementById("ca-user-level").innerText = Math.floor(data.level + 1).toLocaleString();
    document.getElementById("ca-user-pixels").innerText = nextLevelPixels.toLocaleString();
  }
}
function addColorRow(colorId, count, enabled) {
  const c = rgbColorMap.get(colorId) ?? otherColor;
  const row = document.getElementById("ca-color-template").content.cloneNode(true);
  const enable = row.querySelector("input");
  enable.checked = enabled;
  Manager.enabledColors.set(colorId, enabled);
  enable.addEventListener("change", (e) => {
    Manager.enabledColors.set(colorId, e.target.checked);
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  const color = row.querySelector(".ca-color-display");
  color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;
  color.addEventListener("click", (e) => {
    [...document.getElementsByClassName("ca-color-row")].forEach((r) => r.firstElementChild.checked = false);
    e.target.previousElementSibling.checked = true;
    Manager.enabledColors.forEach((_, key) => Manager.enabledColors.set(key, key === colorId));
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  row.querySelector(".ca-color-count").textContent = count.toString();
  row.querySelector(".ca-color-name").textContent = c.name;
  document.getElementById("ca-color-list").appendChild(row);
}
function setNewName(s, template) {
  const newName = s.textContent.replaceAll("\n", "");
  if (newName.length === 0 || Manager.templates.some((t) => t.name === newName)) {
    s.textContent = template.name;
    return;
  }
  template.name = newName;
  s.closest(".ca-template-row").id = `ca-template-id-${newName}`;
  Manager.storeTemplates();
}
function addTemplateRow(template) {
  const row = document.getElementById("ca-template-template").content.cloneNode(true);
  row.firstElementChild.id = `ca-template-id-${template.name}`;
  const count = row.querySelector(".ca-pixel-count");
  count.textContent = template.totalPixelCount.toString();
  const text = row.querySelector(".ca-template-name");
  text.textContent = template.name;
  text.addEventListener("click", (e) => {
    const s = e.target;
    if (!s.hasAttribute("contenteditable")) {
      s.setAttribute("contenteditable", "");
      s.focus();
    }
  });
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const s = e.target;
      s.removeAttribute("contenteditable");
      s.parentElement.scrollTo(0, 0);
      setNewName(s, template);
    }
  });
  text.addEventListener("blur", (e) => {
    const s = e.target;
    s.removeAttribute("contenteditable");
    s.parentElement.scrollTo(0, 0);
    setNewName(s, template);
  });
  const enable = row.querySelector("input");
  enable.checked = template.enabled;
  enable.addEventListener("change", (e) => {
    template.enabled = e.target.checked;
    Manager.resetTiles(template.overlappedTiles);
    Manager.rebuildColorList();
  });
  const del = row.querySelector(".ca-template-delete");
  del.addEventListener("click", () => {
    Manager.deleteTemplate(Manager.templates.indexOf(template));
  });
  document.getElementById("ca-template-list").appendChild(row);
}
function removeTemplateRow(name) {
  document.getElementById(`ca-template-id-${name}`)?.remove();
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

// dist/eventListeners.js
function addListeners() {
  document.getElementById("ca-image-collapse").addEventListener("click", () => {
    document.getElementById("ca-overlay").classList.toggle("collapsed");
  });
  function pasted(e) {
    const values = e.clipboardData?.getData("text").split(" ").filter((n) => n).map(Number).filter((n) => !isNaN(n));
    if (values === void 0 || values.length !== 4)
      return;
    e.preventDefault();
    Manager.setInputCoords(new PixelCoords(values[0], values[1], values[2], values[3]));
  }
  document.getElementById("ca-input-tx").addEventListener("paste", pasted);
  document.getElementById("ca-input-ty").addEventListener("paste", pasted);
  document.getElementById("ca-input-px").addEventListener("paste", pasted);
  document.getElementById("ca-input-py").addEventListener("paste", pasted);
  document.getElementById("ca-coords-button").addEventListener("click", () => {
    if (Manager.lastClickedCoords === null) {
      displayStatus("Click on the canvas first to pick coordinates");
      return;
    }
    Manager.setInputCoords(Manager.lastClickedCoords);
  });
  document.getElementById("ca-copy-coords-button").addEventListener("click", async () => {
    const coords = Manager.getInputCoords();
    if (coords === null)
      return;
    const s = `${coords.tx} ${coords.ty} ${coords.px} ${coords.py}`;
    await navigator.clipboard.writeText(s);
    const svg = document.getElementById("ca-copy-coords-button")?.firstElementChild;
    if (svg !== void 0) {
      svg.style.fill = "#2b8f1f";
      setTimeout(() => svg.style.fill = "", 500);
    }
  });
  document.getElementById("ca-select-button").addEventListener("click", () => {
    document.getElementById("ca-file-input").click();
  });
  document.getElementById("ca-file-input").addEventListener("change", (e) => {
    if (e.target.files.length > 0)
      document.getElementById("ca-select-button").innerText = e.target.files[0].name;
  });
  document.getElementById("ca-create-button").addEventListener("click", (e) => {
    const fileInput = document.getElementById("ca-file-input");
    if (fileInput.files.length < 1) {
      displayStatus("Select a file to upload");
      return;
    }
    const coords = Manager.getInputCoords();
    if (coords === null) {
      displayStatus("Invalid coordonates");
      return;
    }
    e.target.disabled = true;
    Manager.createTemplate(coords, fileInput.files[0]);
    e.target.disabled = false;
  });
  document.getElementById("ca-converter-button").addEventListener("click", () => {
    window.open("https://pepoafonso.github.io/color_converter_wplace/", "_blank", "noopener noreferrer");
  });
}

// dist/app.js
importFont();
injectOverlay();
addListeners();
Manager.loadGlobals();
await Manager.loadTemplates();
document.getElementById("ca-version").innerText = "version " + GM_info.script.version;
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
