// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      1.2.6
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
    this.x = Math.floor(x) % 2048;
    this.y = Math.floor(y) % 2048;
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
    this.tx = (Math.floor(tx) + Math.floor(px / 1e3)) % 2048;
    this.ty = (Math.floor(ty) + Math.floor(py / 1e3)) % 2048;
    this.px = Math.floor(px) % 1e3;
    this.py = Math.floor(py) % 1e3;
  }
  static copy(o) {
    return new _PixelCoords(o.tx, o.ty, o.px, o.py);
  }
  toGeoCoords(center = true) {
    const offset = center ? 0.5 : 0;
    const relativeX = (this.tx * 1e3 + this.px + offset) / (2048 * 1e3);
    const relativeY = 1 - (this.ty * 1e3 + this.py + offset) / (2048 * 1e3);
    return [
      relativeX * 360 - 180,
      360 * Math.atan(Math.exp((relativeY * 2 - 1) * Math.PI)) / Math.PI - 90
    ];
  }
  toTileIndex() {
    return TileCoords.toIndex(this.tx, this.ty);
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
var otherColor = { internalId: -1, id: rgbToId(136, 136, 136), name: "Other", rgb: [136, 136, 136], wplaceOrder: 64 };
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
function computeLuminance(id) {
  const color = rgbColorMap.get(id);
  if (color === otherColor)
    return 1;
  if (color.wplaceOrder === 63)
    return 0;
  return 0.299 * (color.rgb[0] / 255) + 0.587 * (color.rgb[1] / 255) + 0.114 * (color.rgb[2] / 255);
}
function computeHue(id) {
  const color = rgbColorMap.get(id);
  if (color === otherColor)
    return 360;
  if (color.wplaceOrder === 63)
    return 0;
  const [red, green, blue] = color.rgb;
  const min = Math.min(Math.min(red, green), blue);
  const max = Math.max(Math.max(red, green), blue);
  let hue = 0;
  if (max === red)
    hue = (green - blue) / (max - min);
  else if (max === green)
    hue = 2 + (blue - red) / (max - min);
  else
    hue = 4 + (red - green) / (max - min);
  hue *= 60;
  if (hue < 0)
    hue += 360;
  return hue;
}
var colorPalette = [
  { internalId: 0, name: "Transparent", rgb: [222, 250, 206], wplaceOrder: 63 },
  { internalId: 1, name: "Black", rgb: [0, 0, 0], wplaceOrder: 0 },
  { internalId: 2, name: "Dark Gray", rgb: [60, 60, 60], wplaceOrder: 1 },
  { internalId: 3, name: "Gray", rgb: [120, 120, 120], wplaceOrder: 2 },
  { internalId: 4, name: "Light Gray", rgb: [210, 210, 210], wplaceOrder: 4 },
  { internalId: 5, name: "White", rgb: [255, 255, 255], wplaceOrder: 5 },
  { internalId: 6, name: "Deep Red", rgb: [96, 0, 24], wplaceOrder: 6 },
  { internalId: 7, name: "Red", rgb: [237, 28, 36], wplaceOrder: 8 },
  { internalId: 8, name: "Orange", rgb: [255, 127, 39], wplaceOrder: 11 },
  { internalId: 9, name: "Gold", rgb: [246, 170, 9], wplaceOrder: 12 },
  { internalId: 10, name: "Yellow", rgb: [249, 221, 59], wplaceOrder: 13 },
  { internalId: 11, name: "Light Yellow", rgb: [255, 250, 188], wplaceOrder: 14 },
  { internalId: 12, name: "Dark Green", rgb: [14, 185, 104], wplaceOrder: 21 },
  { internalId: 13, name: "Green", rgb: [19, 230, 123], wplaceOrder: 22 },
  { internalId: 14, name: "Light Green", rgb: [135, 255, 94], wplaceOrder: 23 },
  { internalId: 15, name: "Dark Teal", rgb: [12, 129, 110], wplaceOrder: 24 },
  { internalId: 16, name: "Teal", rgb: [16, 174, 166], wplaceOrder: 25 },
  { internalId: 17, name: "Light Teal", rgb: [19, 225, 190], wplaceOrder: 26 },
  { internalId: 18, name: "Dark Blue", rgb: [40, 80, 158], wplaceOrder: 30 },
  { internalId: 19, name: "Blue", rgb: [64, 147, 228], wplaceOrder: 31 },
  { internalId: 20, name: "Cyan", rgb: [96, 247, 242], wplaceOrder: 28 },
  { internalId: 21, name: "Indigo", rgb: [107, 80, 246], wplaceOrder: 34 },
  { internalId: 22, name: "Light Indigo", rgb: [153, 177, 251], wplaceOrder: 35 },
  { internalId: 23, name: "Dark Purple", rgb: [120, 12, 153], wplaceOrder: 39 },
  { internalId: 24, name: "Purple", rgb: [170, 56, 185], wplaceOrder: 40 },
  { internalId: 25, name: "Light Purple", rgb: [224, 159, 249], wplaceOrder: 41 },
  { internalId: 26, name: "Dark Pink", rgb: [203, 0, 122], wplaceOrder: 42 },
  { internalId: 27, name: "Pink", rgb: [236, 31, 128], wplaceOrder: 43 },
  { internalId: 28, name: "Light Pink", rgb: [243, 141, 169], wplaceOrder: 44 },
  { internalId: 29, name: "Dark Brown", rgb: [104, 70, 52], wplaceOrder: 48 },
  { internalId: 30, name: "Brown", rgb: [149, 104, 42], wplaceOrder: 49 },
  { internalId: 31, name: "Beige", rgb: [248, 178, 119], wplaceOrder: 55 },
  { internalId: 32, name: "Medium Gray", rgb: [170, 170, 170], wplaceOrder: 3 },
  { internalId: 33, name: "Dark Red", rgb: [165, 14, 30], wplaceOrder: 7 },
  { internalId: 34, name: "Light Red", rgb: [250, 128, 114], wplaceOrder: 9 },
  { internalId: 35, name: "Dark Orange", rgb: [228, 92, 26], wplaceOrder: 10 },
  { internalId: 36, name: "Light Tan", rgb: [214, 181, 148], wplaceOrder: 53 },
  { internalId: 37, name: "Dark Goldenrod", rgb: [156, 132, 49], wplaceOrder: 15 },
  { internalId: 38, name: "Goldenrod", rgb: [197, 173, 49], wplaceOrder: 16 },
  { internalId: 39, name: "Light Goldenrod", rgb: [232, 212, 95], wplaceOrder: 17 },
  { internalId: 40, name: "Dark Olive", rgb: [74, 107, 58], wplaceOrder: 18 },
  { internalId: 41, name: "Olive", rgb: [90, 148, 74], wplaceOrder: 19 },
  { internalId: 42, name: "Light Olive", rgb: [132, 197, 115], wplaceOrder: 20 },
  { internalId: 43, name: "Dark Cyan", rgb: [15, 121, 159], wplaceOrder: 27 },
  { internalId: 44, name: "Light Cyan", rgb: [187, 250, 242], wplaceOrder: 29 },
  { internalId: 45, name: "Light Blue", rgb: [125, 199, 255], wplaceOrder: 32 },
  { internalId: 46, name: "Dark Indigo", rgb: [77, 49, 184], wplaceOrder: 33 },
  { internalId: 47, name: "Dark Slate Blue", rgb: [74, 66, 132], wplaceOrder: 36 },
  { internalId: 48, name: "Slate Blue", rgb: [122, 113, 196], wplaceOrder: 37 },
  { internalId: 49, name: "Light Slate Blue", rgb: [181, 174, 241], wplaceOrder: 38 },
  { internalId: 50, name: "Light Brown", rgb: [219, 164, 99], wplaceOrder: 50 },
  { internalId: 51, name: "Dark Beige", rgb: [209, 128, 81], wplaceOrder: 54 },
  { internalId: 52, name: "Light Beige", rgb: [255, 197, 165], wplaceOrder: 56 },
  { internalId: 53, name: "Dark Peach", rgb: [155, 82, 73], wplaceOrder: 45 },
  { internalId: 54, name: "Peach", rgb: [209, 128, 120], wplaceOrder: 46 },
  { internalId: 55, name: "Light Peach", rgb: [250, 182, 164], wplaceOrder: 47 },
  { internalId: 56, name: "Dark Tan", rgb: [123, 99, 82], wplaceOrder: 51 },
  { internalId: 57, name: "Tan", rgb: [156, 132, 107], wplaceOrder: 52 },
  { internalId: 58, name: "Dark Slate", rgb: [51, 57, 65], wplaceOrder: 60 },
  { internalId: 59, name: "Slate", rgb: [109, 117, 141], wplaceOrder: 61 },
  { internalId: 60, name: "Light Slate", rgb: [179, 185, 209], wplaceOrder: 62 },
  { internalId: 61, name: "Dark Stone", rgb: [109, 100, 63], wplaceOrder: 57 },
  { internalId: 62, name: "Stone", rgb: [148, 140, 107], wplaceOrder: 58 },
  { internalId: 63, name: "Light Stone", rgb: [205, 197, 158], wplaceOrder: 59 }
];
var rgbColorMap = /* @__PURE__ */ new Map();
for (const color of colorPalette) {
  rgbColorMap.set(rgbToId(...color.rgb), { ...color, id: rgbToId(...color.rgb) });
}

// dist/Template.js
var Template = class _Template {
  name;
  coords;
  width;
  height;
  imageData;
  tiles;
  totalProgress;
  enabled;
  base64Data;
  constructor(name, coords, width, height) {
    this.name = name;
    this.coords = coords;
    this.width = width;
    this.height = height;
    this.imageData = null;
    this.totalProgress = {
      total: 0,
      unpainted: 0,
      wrong: 0
    };
    this.tiles = /* @__PURE__ */ new Map();
    this.enabled = true;
    this.base64Data = "";
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
        if (imageData.data[pixelIndex + 3] < 128)
          continue;
        const tileIndex = new PixelCoords(coords.tx, coords.ty, coords.px + x, coords.py + y).toTileIndex();
        let tile = template.tiles.get(tileIndex);
        if (tile === void 0) {
          tile = /* @__PURE__ */ new Map();
          template.tiles.set(tileIndex, tile);
        }
        const color = getClosestColor(imageData.data[pixelIndex + 0], imageData.data[pixelIndex + 1], imageData.data[pixelIndex + 2]);
        let progress = tile.get(color.id);
        if (progress === void 0) {
          progress = {
            total: 0,
            unpainted: 0,
            wrong: 0
          };
          tile.set(color.id, progress);
        }
        progress.total++;
        progress.unpainted++;
        template.totalProgress.total++;
        template.totalProgress.unpainted++;
        if (color !== otherColor) {
          imageData.data[pixelIndex + 0] = color.rgb[0];
          imageData.data[pixelIndex + 1] = color.rgb[1];
          imageData.data[pixelIndex + 2] = color.rgb[2];
        }
      }
    template.imageData = imageData.data;
    let binary = "";
    for (let i = 0; i < template.imageData.length; i++) {
      binary += String.fromCharCode(template.imageData[i]);
    }
    template.base64Data = LZString.compress(btoa(binary));
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
    template.tiles = /* @__PURE__ */ new Map();
    for (const [index, colors] of stored.tiles) {
      const progress = /* @__PURE__ */ new Map();
      for (const [id, total] of colors) {
        progress.set(id, {
          total,
          unpainted: total,
          wrong: 0
        });
        template.totalProgress.total += total;
        template.totalProgress.unpainted += total;
      }
      template.tiles.set(index, progress);
    }
    return template;
  }
  overlaps(tile) {
    return this.tiles.has(tile);
  }
  drawOnTile(tile, ctx, trackProgress) {
    if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
      return;
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const canvasImageData = imageData.data;
    const isFirstX = this.coords.tx === tile.x;
    const isFirstY = this.coords.ty === tile.y;
    const colors = /* @__PURE__ */ new Map();
    for (let iy = isFirstY ? 0 : (tile.y - this.coords.ty) * 1e3 - this.coords.py, cy = isFirstY ? this.coords.py : 0; iy < this.height && cy < 1e3; iy++, cy++)
      for (let ix = isFirstX ? 0 : (tile.x - this.coords.tx) * 1e3 - this.coords.px, cx = isFirstX ? this.coords.px : 0; ix < this.width && cx < 1e3; ix++, cx++) {
        const imagePixelIndex = (iy * this.width + ix) * 4;
        const canvasPixelIndex = ((cy * Manager.patternSize + 1) * ctx.canvas.width + cx * Manager.patternSize + 1) * 4;
        if (this.imageData[imagePixelIndex + 3] === 0)
          continue;
        const color = getColor(this.imageData[imagePixelIndex + 0], this.imageData[imagePixelIndex + 1], this.imageData[imagePixelIndex + 2]);
        const paintedColor = getClosestColor(canvasImageData[canvasPixelIndex + 0], canvasImageData[canvasPixelIndex + 1], canvasImageData[canvasPixelIndex + 2]);
        const colorInfo = Manager.colorsInfo.get(color.id);
        if (trackProgress) {
          let progress = colors.get(color.id);
          if (progress === void 0) {
            progress = {
              total: 0,
              unpainted: 0,
              wrong: 0
            };
            colors.set(color.id, progress);
          }
          progress.total++;
          if (canvasImageData[canvasPixelIndex + 3] === 0) {
            progress.unpainted++;
            if (colorInfo.unpainted === null)
              colorInfo.unpainted = new PixelCoords(tile.x, tile.y, cx, cy);
          } else if (color !== paintedColor) {
            progress.wrong++;
            colorInfo.unpainted = new PixelCoords(tile.x, tile.y, cx, cy);
          } else if (colorInfo.unpainted?.tx === tile.x && colorInfo.unpainted?.ty === tile.y && // Correct
          colorInfo.unpainted?.px === cx && colorInfo.unpainted?.py === cy) {
            colorInfo.unpainted = null;
          }
        }
        if (colorInfo.enabled) {
          if (Manager.settings.wrongHighlight && canvasImageData[canvasPixelIndex + 3] !== 0 && color !== paintedColor) {
            for (const [dx, dy] of [[0, 1], [1, 0], [2, 1], [1, 2]]) {
              const idx = ((cy * Manager.patternSize + dy) * ctx.canvas.width + cx * Manager.patternSize + dx) * 4;
              canvasImageData[idx + 0] = 255;
              canvasImageData[idx + 1] = 0;
              canvasImageData[idx + 2] = 0;
              canvasImageData[idx + 3] = 255;
            }
          }
          canvasImageData[canvasPixelIndex + 0] = this.imageData[imagePixelIndex + 0];
          canvasImageData[canvasPixelIndex + 1] = this.imageData[imagePixelIndex + 1];
          canvasImageData[canvasPixelIndex + 2] = this.imageData[imagePixelIndex + 2];
          canvasImageData[canvasPixelIndex + 3] = this.imageData[imagePixelIndex + 3];
        }
      }
    if (trackProgress) {
      this.tiles.set(tile.toIndex(), colors);
      this.updateTotalProgress();
      updateTemplatePixelCount(this);
    }
    ctx.putImageData(imageData, 0, 0);
  }
  updateTotalProgress() {
    this.totalProgress.total = 0;
    this.totalProgress.unpainted = 0;
    this.totalProgress.wrong = 0;
    for (const colors of this.tiles.values())
      for (const progress of colors.values()) {
        this.totalProgress.total += progress.total;
        this.totalProgress.unpainted += progress.unpainted;
        this.totalProgress.wrong += progress.wrong;
      }
  }
  toJSON(_) {
    return {
      name: this.name,
      coords: this.coords,
      width: this.width,
      height: this.height,
      tiles: this.tiles.entries().toArray().map(([index, colors]) => [index, colors.entries().toArray().map(([id, progress]) => [id, progress.total])]),
      enabled: this.enabled,
      base64Data: this.base64Data
    };
  }
};

// dist/Manager.js
var ManagerClass = class _ManagerClass {
  patternSize = 3;
  templates;
  tilesInfo;
  colorsInfo;
  lastClickedCoords;
  colorSorting;
  colorSortingReversed;
  loggedIn;
  settings;
  wplaceMap;
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
    this.colorsInfo = /* @__PURE__ */ new Map();
    this.lastClickedCoords = null;
    this.colorSorting = "Total";
    this.colorSortingReversed = false;
    this.loggedIn = false;
    this.settings = {
      wrongHighlight: false
    };
    this.wplaceMap = null;
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
    this.colorSorting = stored.colorSorting || "Total";
    document.getElementById("ca-sort-select").value = this.colorSorting;
    this.colorSortingReversed = stored.colorSortingReversed;
    this.colorsInfo = new Map(stored.enabledColors.map(([id, enabled]) => [id, { enabled, unpainted: null }]));
  }
  storeGlobal(overrides) {
    _ManagerClass.#storeValue("global", {
      inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
      colorSorting: this.colorSorting,
      colorSortingReversed: this.colorSortingReversed,
      enabledColors: this.colorsInfo.entries().toArray().map(([id, colorInfo]) => [id, colorInfo.enabled])
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
      this.resetTiles(template.tiles.keys());
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
    this.resetTiles(template.tiles.keys());
    this.templates.push(template);
    this.storeTemplates();
    addTemplateRow(template);
    this.rebuildColorList();
    displayStatus("Created template at " + template.coords.toString() + ": " + template.totalProgress.total + " pixels");
    return template;
  }
  deleteTemplate(index) {
    const template = this.templates[index];
    if (template === void 0)
      return;
    this.resetTiles(template.tiles.keys());
    this.templates.splice(index, 1);
    this.storeTemplates();
    removeTemplateRow(template.name);
    this.rebuildColorList();
  }
  rebuildColorList() {
    const list = document.getElementById("ca-color-list");
    while (list.firstChild)
      list.firstChild.remove();
    const colorProgress = /* @__PURE__ */ new Map();
    for (const template of this.templates) {
      if (template.enabled)
        for (const [_, colors] of template.tiles)
          for (const [id, progress] of colors) {
            let totalProgress = colorProgress.get(id);
            if (totalProgress === void 0) {
              totalProgress = { total: 0, unpainted: 0, wrong: 0 };
              colorProgress.set(id, totalProgress);
            }
            totalProgress.total += progress.total;
            totalProgress.unpainted += progress.unpainted;
            totalProgress.wrong += progress.wrong;
          }
    }
    for (const id of this.colorsInfo.keys()) {
      if (!colorProgress.has(id))
        this.colorsInfo.delete(id);
    }
    const colorsArray = colorProgress.entries().toArray();
    switch (Manager.colorSorting) {
      case "Total":
        colorsArray.sort((a, b) => b[1].total - a[1].total);
        break;
      case "Remaining":
        colorsArray.sort((a, b) => b[1].unpainted + b[1].wrong - a[1].unpainted - a[1].wrong);
        break;
      case "Wrong":
        colorsArray.sort((a, b) => b[1].wrong - a[1].wrong);
        break;
      case "Original":
        colorsArray.sort((a, b) => rgbColorMap.get(a[0]).wplaceOrder - rgbColorMap.get(b[0]).wplaceOrder);
        break;
      case "Luminance":
        colorsArray.sort((a, b) => computeLuminance(a[0]) - computeLuminance(b[0]));
        break;
      case "Hue":
        colorsArray.sort((a, b) => computeHue(b[0]) - computeHue(a[0]));
        break;
      default:
        const n = Manager.colorSorting;
        n;
    }
    if (this.colorSortingReversed)
      colorsArray.reverse();
    for (const [id, progress] of colorsArray) {
      if (!this.colorsInfo.has(id))
        this.colorsInfo.set(id, { enabled: true, unpainted: null });
      addColorRow(id, progress);
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
    let tileInfo = this.tilesInfo.get(tileIndex);
    if (tileInfo === void 0) {
      tileInfo = {
        lastModified: 0,
        blob: null
      };
      this.tilesInfo.set(tileIndex, tileInfo);
    }
    let modifiedBlob = tileInfo.blob;
    if (modifiedBlob === null || tileInfo.lastModified < lastModified || response.type === "basic") {
      const blob = await response.blob();
      const trackProgress = response.type !== "basic" || modifiedBlob === null;
      modifiedBlob = await this.drawOnTile(tile, blob, trackProgress);
      if (trackProgress) {
        this.rebuildColorList();
        tileInfo.blob = modifiedBlob;
        tileInfo.lastModified = lastModified;
      }
    }
    return new Response(modifiedBlob, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  }
  async drawOnTile(tile, blob, trackProgress) {
    let allDisabled = true;
    for (const enabled of Manager.colorsInfo.values()) {
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
        template.drawOnTile(tile, ctx, trackProgress);
    }
    return await canvas.convertToBlob();
  }
  flyTo(coords, zoom = 13) {
    Manager.wplaceMap?.flyTo({ center: coords.toGeoCoords(), zoom });
  }
};
var Manager = new ManagerClass();

// dist/display.js
function injectOverlay() {
  document.body.appendChild(document.createElement("div")).outerHTML = `
<div id="ca-overlay">
    <template id="ca-color-template">
        <div class="ca-color-row">
            <input type="checkbox" />
            <div class="ca-color-display"></div>
            <button class="ca-icon-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm230-240L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Z"></path>
                </svg>
            </button>
            <span class="ca-color-count"></span>
            <span> • </span>
            <span class="ca-color-name"></span>
        </div>
    </template>
    <template id="ca-template-template">
        <div class="ca-template-row">
            <div class="ca-template-flex">
                <button class="ca-icon-button ca-template-fly">✈️</button>
                <span class="ca-template-name"></span>
                <div class="ca-template-right">
                    <input type="checkbox" />
                    <button class="ca-icon-button ca-template-delete">🗑️</button>
                </div>
            </div>
            <div class="ca-template-counts">
                <span class="ca-pixel-count"></span>
                <span class="ca-wrong-count"></span>
            </div>
        </div>
    </template>

    <div id="ca-header">
        <img id="ca-image-collapse" src="https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg" />
        <h1>Camoverlay</h1>
    </div>
    <hr />
    <div>
        <p>Username: <b id="ca-user-name"></b></p>
        <p>Droplets: <b id="ca-user-droplets"></b></p>
        <p>Level <b id="ca-user-level">0</b> in <b id="ca-user-pixels">0</b> pixels</p>
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
            </button>
            <input id="ca-input-tx" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl X" />
            <input id="ca-input-ty" class="ca-coords-input" type="number" min="0" max="2047" step="1" placeholder="Tl Y" />
            <input id="ca-input-px" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px X" />
            <input id="ca-input-py" class="ca-coords-input" type="number" min="0" max="999" step="1" placeholder="Px Y" />
            <button id="ca-copy-coords-button" class="ca-icon-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M11 7h6v6h-6z" />
                    <path d="M6.5 3h8.1c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v7.1M6.2 21h8.1c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874c.218-.428.218-.988.218-2.108V9.7c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C15.98 6.5 15.42 6.5 14.3 6.5H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 8.02 3 8.58 3 9.7v8.1c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21" stroke-width="2" stroke-linecap="round" />
                </svg>
            </button>
        </div>
        <div id="ca-settings">
            <div>
                <input id="ca-setting-wrong-highlight" type="checkbox">
                Highlight wrong pixels
            </div>
        </div>
        <div id="ca-sorting">
            Sort:
            <select id="ca-sort-select">
                <option value="Total">Total pixels</option>
                <option value="Remaining">Remaining pixels</option>
                <option value="Wrong">Wrong pixels</option>
                <option value="Original">Original</option>
                <option value="Luminance">Luminance</option>
                <option value="Hue">Hue</option>
            </select>
            <button id="ca-sort-reverse" class="ca-icon-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 489.389 489.389">
                    <path d="M261.294 326.102c-8.3-7.3-21.8-6.2-29.1 2.1l-77 86.8v-346.9c0-11.4-9.4-20.8-20.8-20.8s-20.8 9.4-20.8 20.8v346.9l-77-86.8c-8.3-8.3-20.8-9.4-29.1-2.1-8.3 8.3-9.4 20.8-2.1 29.1l113.4 126.9c8.5 10.5 23.5 8.9 30.2 0l114.4-126.9c7.3-8.2 6.3-21.8-2.1-29.1m222.7-191.4-112.4-126.9c-10-10.1-22.5-10.7-31.2 0l-114.4 126.9c-7.3 8.3-6.2 21.8 2.1 29.1 12.8 10.2 25.7 3.2 29.1-2.1l77-86.8v345.9c0 11.4 9.4 20.8 20.8 20.8s20.8-8.3 20.8-19.8v-346.8l77 86.8c8.3 8.3 20.8 9.4 29.1 2.1 8.3-8.4 9.4-20.9 2.1-29.2"></path>
                </svg>
            </button>
        </div>
        <div id="ca-color-list-buttons">
            <button id="ca-enable-all" class="tooltip">
                <div class="tooltip-content">
                    <kbd class="kbd kbd-xs text-base-content touchscreen:hidden ml-0.5 rounded-md">A</kbd>
                </div>
                Enable All
            </button>
            <button id="ca-disable-all" class="tooltip">
                <div class="tooltip-content">
                    <kbd class="kbd kbd-xs text-base-content touchscreen:hidden ml-0.5 rounded-md">D</kbd>
                </div>
                Disable All
            </button>
            <button id="ca-enable-selected" class="ca-icon-button tooltip">
                <div class="tooltip-content">
                    <kbd class="kbd kbd-xs text-base-content touchscreen:hidden ml-0.5 rounded-md">V</kbd>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path d="M120-120v-190l358-358-58-56 58-56 76 76 124-124q5-5 12.5-8t15.5-3q8 0 15 3t13 8l94 94q5 6 8 13t3 15q0 8-3 15.5t-8 12.5L705-555l76 78-57 57-56-58-358 358H120Zm80-80h78l332-334-76-76-334 332v78Zm447-410 96-96-37-37-96 96 37 37Zm0 0-37-37 37 37Z"></path>
                </svg>
            </button>
        </div>
        <div id="ca-color-list"></div>
        <div id="ca-templates">
            <div id="ca-template-buttons">
                <input id="ca-file-input" type="file" accept="image/png" />
                <button id="ca-select-button">Select file</button>
                <button id="ca-create-button">Create</button>
            </div>
            <div id="ca-template-list"></div>
        </div>
        <textarea id="ca-output" readonly placeholder="Sleeping"></textarea>
        <div id="ca-bottom">
            <div>
                <button id="ca-converter-button" class="ca-icon-button">🎨</button>
            </div>
            <small>
                <span>Made by Sonyo<br>Original by SwingTheVine<br>Art by <a href="https://camomille1411en.carrd.co/" target="_blank">camomille1411</a><br></span>
                <span id="ca-version"></span>
            </small>
        </div>
    </div>
</div>`.replace(/>\s*</g, "><");
  GM_addStyle(`
#ca-overlay {
    background-color: #5D1F18E6;
    border-radius: 8px;
    color: white;
    max-height: 100%;
    max-width: 300px;
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

#ca-overlay select {
    border: white 1px solid;
    border-radius: 0.5em;
    background-color: #ab2314;
    font-size: small;
}
#ca-overlay select:hover, #ca-overlay select:open {
    background-color: #b14438;
}

#ca-overlay select:active {
    background-color: #b66d65;
}

#ca-overlay select:disabled {
    background-color: #b66d65;
    cursor: not-allowed;
}

#ca-overlay .tooltip-content {
    font-size: 90%;
}
#ca-overlay .tooltip-content > kbd {
    margin-left: 0;
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
    fill: white;
    stroke: #111;
    transition-property: fill;
    transition-duration: 250ms;
    width: 70%;
}

#ca-settings {
    background-color: #FF000033;
    border-radius: 0.5em;
    font-size: 80%;
    margin-top: 0.5em;
    padding: 0 1ch;
    text-align: center;
}
#ca-settings > div {
    display: flex;
    gap: 1ch;
    width: fit-content;
}
#ca-settings input {
    filter: hue-rotate(160deg);
}

#ca-color-list-buttons {
    display: flex;
    font-size: 80%;
    gap: 0.75ch;
    justify-content: space-between;
    margin-top: 0.5em;
}
#ca-enable-selected svg {
    width: 80%;
}

#ca-sorting {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5em;
}

#ca-sort-select {
    flex: 1 0 auto;
    text-align: center;
    margin: 0 1ch;
}

#ca-sort-reverse > svg {
    width: 65%;
    stroke: #111;
    stroke-width: 10px;
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
    background: linear-gradient(90deg, #F003 var(--ca-color-progress), #4F0333AA var(--ca-color-progress) var(--ca-color-wrong), transparent var(--ca-color-wrong));
    display: flex;
    flex-direction: row;
    gap: 0.5ch;
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
    background-color: #FF000033;
    border-radius: 1em;
    margin-bottom: 3px;
    text-align: center;
}
.ca-template-flex {
    display: flex;
    justify-content: space-between;
    gap: 1ch;
}
.ca-template-flex > * {
    flex: 0 0 auto;
}
.ca-template-name {
    flex: unset;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ca-template-name {
    font-weight: bold;
}
.ca-template-right {
    display: flex;
}
.ca-template-right input {
    height: 1.5em;
    margin-right: 0.5ch;
    filter: hue-rotate(70deg);
}
.ca-template-counts {
    padding: 0 1ch;
}

#ca-output {
    font-size: small;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0 0.5ch;
    margin-top: 0.5em;
    height: 3.2em;
    resize: none;
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
function addColorRow(colorId, progress) {
  const c = rgbColorMap.get(colorId) ?? otherColor;
  const row = document.getElementById("ca-color-template").content.cloneNode(true);
  const div = row.firstElementChild;
  div.id = "ca-color-id-" + colorId;
  div.style.setProperty("--ca-color-progress", (progress.total - progress.unpainted - progress.wrong) / progress.total * 100 + "%");
  div.style.setProperty("--ca-color-wrong", (progress.total - progress.unpainted) / progress.total * 100 + "%");
  const enable = row.querySelector("input");
  enable.checked = Manager.colorsInfo.get(colorId).enabled;
  enable.addEventListener("change", (e) => {
    Manager.colorsInfo.get(colorId).enabled = e.target.checked;
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  const color = row.querySelector(".ca-color-display");
  color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;
  color.addEventListener("click", (e) => {
    [...document.getElementsByClassName("ca-color-row")].forEach((r) => r.firstElementChild.checked = false);
    e.target.previousElementSibling.checked = true;
    Manager.colorsInfo.forEach((_, key) => Manager.colorsInfo.get(key).enabled = key === colorId);
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  const paint = row.querySelector("button");
  if (!Manager.loggedIn)
    paint.style.display = "none";
  paint.addEventListener("click", () => {
    document.getElementsByClassName("btn btn-primary btn-lg sm:btn-xl relative z-30")[0]?.click();
    setTimeout(() => {
      const container = document.getElementsByClassName("mb-4 mt-3")[0].firstElementChild;
      for (const div2 of container.children) {
        const button = div2.firstElementChild;
        const colorName = div2.getAttribute("data-tip");
        if (colorName === c.name) {
          button.click();
          return;
        }
      }
    });
  });
  paint.addEventListener("dblclick", () => {
    const coords = Manager.colorsInfo.get(colorId)?.unpainted;
    if (coords)
      Manager.flyTo(coords, 16.5);
  });
  switch (Manager.colorSorting) {
    case "Total":
    case "Original":
    case "Luminance":
    case "Hue":
      row.querySelector(".ca-color-count").textContent = progress.total.toString();
      break;
    case "Remaining":
      row.querySelector(".ca-color-count").textContent = (progress.unpainted + progress.wrong).toString();
      break;
    case "Wrong":
      row.querySelector(".ca-color-count").textContent = progress.wrong.toString();
      break;
    default:
      const n = Manager.colorSorting;
      n;
      break;
  }
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
  const fly = row.querySelector(".ca-template-fly");
  fly.addEventListener("click", () => {
    Manager.flyTo(new PixelCoords(template.coords.tx, template.coords.ty, template.coords.px + template.width / 2, template.coords.py + template.height / 2));
  });
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
      s.scrollTo(0, 0);
      setNewName(s, template);
    } else if (e.key === "Escape") {
      e.preventDefault();
      const s = e.target;
      s.removeAttribute("contenteditable");
      s.scrollTo(0, 0);
      s.textContent = template.name;
    }
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, { capture: true });
  text.addEventListener("blur", (e) => {
    const s = e.target;
    s.removeAttribute("contenteditable");
    s.scrollTo(0, 0);
    setNewName(s, template);
  });
  text.addEventListener("keypress", (e) => e.stopPropagation(), { capture: true });
  const enable = row.querySelector("input");
  enable.checked = template.enabled;
  enable.addEventListener("change", (e) => {
    template.enabled = e.target.checked;
    Manager.resetTiles(template.tiles.keys());
    Manager.rebuildColorList();
  });
  const del = row.querySelector(".ca-template-delete");
  del.addEventListener("click", () => {
    Manager.deleteTemplate(Manager.templates.indexOf(template));
  });
  document.getElementById("ca-template-list").appendChild(row);
  updateTemplatePixelCount(template);
}
function updateTemplatePixelCount(template) {
  const row = document.getElementById(`ca-template-id-${template.name}`);
  if (row) {
    const count = row.querySelector(".ca-pixel-count");
    const painted = template.totalProgress.total - template.totalProgress.unpainted - template.totalProgress.wrong;
    count.textContent = `${painted} / ${template.totalProgress.total} (${Math.round(painted / template.totalProgress.total * 1e3) / 10}%)`;
    const wrong = row.querySelector(".ca-wrong-count");
    wrong.textContent = template.totalProgress.wrong > 0 ? ` \u2022 ${template.totalProgress.wrong}\u274C` : "";
  }
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
async function getMapObject() {
  const origMapValues = Map.prototype.values;
  const hookedMapValues = function() {
    this.forEach((v) => {
      if (v?.maps instanceof Set)
        v.maps.forEach((x) => {
          if (x?.flyTo) {
            Manager.wplaceMap = x;
            Map.prototype.values = origMapValues;
          }
        });
    });
    return origMapValues.call(this);
  };
  Map.prototype.values = hookedMapValues;
  let canvas;
  do {
    await new Promise((resolve) => setTimeout(resolve, 500));
    canvas = document.querySelector("canvas.maplibregl-canvas");
  } while (canvas === null);
  let popup = null;
  while (popup === null) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const ev = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
      button: 0
    });
    canvas.dispatchEvent(ev);
    let i = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 50));
      popup = document.getElementsByClassName("rounded-t-box bg-base-100 border-base-300 sm:rounded-b-box w-full border-t pt-2 sm:mb-3 sm:shadow-xl")[0]?.firstElementChild?.firstElementChild?.lastElementChild ?? null;
      i++;
    } while (popup === null && i < 10);
  }
  popup.click();
}

// dist/eventListeners.js
function addListeners() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey)
      return;
    switch (e.key) {
      case "v":
        document.getElementById("ca-enable-selected").click();
        break;
      case "a":
        document.getElementById("ca-enable-all").click();
        break;
      case "d":
        document.getElementById("ca-disable-all").click();
        break;
      case "n":
        const colorList = document.getElementById("ca-color-list");
        for (let i = 0; i < colorList.childElementCount; i++) {
          if (colorList.children[i].firstElementChild.checked) {
            const nextRow = colorList.children[i + 1];
            if (nextRow === void 0)
              break;
            nextRow.children[1].click();
            nextRow.children[2].click();
            nextRow.scrollIntoView({ "behavior": "smooth", "block": "center" });
            break;
          }
        }
        break;
      case "N":
        const colorListR = document.getElementById("ca-color-list");
        for (let i = 0; i < colorListR.childElementCount; i++) {
          if (colorListR.children[i].firstElementChild.checked) {
            const nextRow = colorListR.children[i - 1];
            if (nextRow === void 0)
              break;
            nextRow.children[1].click();
            nextRow.children[2].click();
            nextRow.scrollIntoView({ "behavior": "smooth", "block": "center" });
            break;
          }
        }
        break;
      case "i":
        if (Manager.loggedIn)
          document.getElementsByClassName("btn btn-primary btn-lg sm:btn-xl relative z-30")[0]?.click();
        break;
      case "Escape":
        document.querySelector('[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"]')?.parentElement?.parentElement?.click();
        break;
    }
  });
  document.getElementById("ca-image-collapse").addEventListener("click", () => {
    const overlay = document.getElementById("ca-overlay");
    if (overlay.classList.contains("collapsed")) {
      overlay.classList.remove("collapsed");
      setTimeout(() => {
        overlay.style.overflow = "";
      }, 500);
    } else {
      overlay.style.overflow = "hidden";
      overlay.classList.add("collapsed");
    }
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
  document.getElementById("ca-setting-wrong-highlight").addEventListener("change", (e) => {
    Manager.settings.wrongHighlight = e.target.checked;
    Manager.tilesInfo.clear();
  });
  document.getElementById("ca-sort-select").addEventListener("change", (e) => {
    Manager.colorSorting = e.target.value;
    Manager.storeGlobal();
    Manager.rebuildColorList();
  });
  document.getElementById("ca-sort-reverse").addEventListener("click", () => {
    Manager.colorSortingReversed = !Manager.colorSortingReversed;
    Manager.rebuildColorList();
  });
  document.getElementById("ca-enable-all").addEventListener("click", () => {
    Manager.colorsInfo.forEach((colorInfo, id) => {
      colorInfo.enabled = true;
      (document.getElementById("ca-color-id-" + id)?.firstElementChild).checked = true;
    });
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  document.getElementById("ca-disable-all").addEventListener("click", () => {
    Manager.colorsInfo.forEach((colorInfo, id) => {
      colorInfo.enabled = false;
      (document.getElementById("ca-color-id-" + id)?.firstElementChild).checked = false;
    });
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  document.getElementById("ca-enable-selected").addEventListener("click", () => {
    const background = document.getElementsByClassName("mb-4 mt-3")[0]?.getElementsByClassName("border-primary")[0]?.style.background;
    if (background === void 0) {
      displayStatus(`No color selected`);
      return;
    }
    let rgb = background.slice(4, -1).split(", ").map(Number);
    if (rgb.length !== 3)
      rgb = [222, 250, 206];
    const color = getColor(rgb[0], rgb[1], rgb[2]);
    let inPalette = false;
    Manager.colorsInfo.forEach((colorInfo, id) => {
      const checkbox = document.getElementById("ca-color-id-" + id)?.firstElementChild;
      if (id === color.id) {
        inPalette = true;
        colorInfo.enabled = true;
        checkbox.checked = true;
        checkbox.scrollIntoView({ "behavior": "smooth", "block": "center" });
      } else {
        colorInfo.enabled = false;
        checkbox.checked = false;
      }
    });
    if (!inPalette)
      displayStatus(`${color.name} is not in palette`);
    Manager.tilesInfo.clear();
    Manager.storeGlobal();
  });
  document.getElementById("ca-select-button").addEventListener("click", () => {
    document.getElementById("ca-file-input").click();
  });
  document.getElementById("ca-select-button").addEventListener("contextmenu", (e) => {
    document.getElementById("ca-select-button").textContent = "Select file";
    document.getElementById("ca-file-input").value = "";
    e.preventDefault();
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
      displayStatus("Invalid coordinates");
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
getMapObject();
importFont();
injectOverlay();
addListeners();
Manager.loadGlobals();
await Manager.loadTemplates();
document.getElementById("ca-version").innerText = "version " + GM_info.script.version;
var originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function(input, init) {
  const url = input instanceof Request ? input.url : input;
  const method = init?.method ?? "GET";
  const response = await originalFetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && url.includes("/me") && method === "GET") {
    const json = await response.clone().json();
    if (json.status && json.status.toString()[0] !== "2") {
      displayStatus("Could not fetch user data, are you logged in?");
      document.querySelectorAll(".ca-color-row button").forEach((b) => b.style.display = "none");
      Manager.loggedIn = false;
    } else {
      displayUserData(json);
      document.querySelectorAll(".ca-color-row button").forEach((b) => b.style.display = "");
      Manager.loggedIn = true;
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
