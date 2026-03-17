// ==UserScript==
// @name         Camoverlay
// @namespace    https://github.com/Sonyo-UwU/
// @version      1.11.1
// @description  A remake of Blue Marble
// @author       Sonyo
// @license      ISC
// @icon         https://cdn.bsky.app/img/avatar/plain/did:plc:kwmxodxbf5nshavpy5r5l3jj/bafkreiaddzuq5vgrpi3aeufp7gwkbameb426d4vb4zlxvc6c4vo23wkn5a@jpeg
// @source       https://github.com/Sonyo-UwU/Camoverlay
// @updateURL    https://github.com/Sonyo-UwU/Camoverlay/raw/refs/heads/main/out/Camoverlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Sonyo-UwU/Camoverlay/main/out/Camoverlay.user.js
// @match        https://wplace.live/*
// @noframes
// @run-at       document-body
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
    this.tx = (Math.floor(tx) + Math.floor(px / 1e3)) % 2048;
    this.ty = (Math.floor(ty) + Math.floor(py / 1e3)) % 2048;
    this.px = px % 1e3;
    this.py = py % 1e3;
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
  static toIndex(tx, ty, px, py) {
    return (tx * 1e4 + ty) * 1e6 + (px * 1e3 + py);
  }
  static fromIndex(i) {
    return new _PixelCoords(Math.floor(i / 1e4 / 1e6), Math.floor(i / 1e6) % 1e4, Math.floor(i / 1e3) % 1e3, i % 1e3);
  }
  toIndex() {
    return _PixelCoords.toIndex(this.tx, this.ty, this.px, this.py);
  }
  toTileIndex() {
    return TileCoords.toIndex(this.tx, this.ty);
  }
  toString() {
    return `[${this.tx}, ${this.ty} ; ${this.px}, ${this.py}]`;
  }
};

// dist/PRNG.js
function splitmix32(a) {
  return function() {
    a |= 0;
    a = a + 2654435769 | 0;
    let t = a ^ a >>> 16;
    t = Math.imul(t, 569420461);
    t = t ^ t >>> 15;
    t = Math.imul(t, 1935289751);
    return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
  };
}

// dist/Template.js
var Template = class _Template {
  name;
  coords;
  width;
  height;
  tiles;
  totalProgress;
  enabled;
  base64Data;
  modifyPixels;
  constructor(name, coords, width, height) {
    this.name = name;
    this.coords = coords;
    this.width = width;
    this.height = height;
    this.totalProgress = {
      total: 0,
      unpainted: 0,
      wrong: 0
    };
    this.tiles = /* @__PURE__ */ new Map();
    this.enabled = true;
    this.base64Data = "";
    this.modifyPixels = [];
  }
  static async fromFile(name, coords, file) {
    const bitmap = await createImageBitmap(file);
    const template = new _Template(name, coords, bitmap.width, bitmap.height);
    const { promise, resolve, reject } = Promise.withResolvers();
    setTimeout(reject, 60 * 1e3);
    Manager.workerCreateTemplateResolve.set(name, resolve);
    const message = {
      name: "CreateTemplate",
      data: {
        name,
        bitmap,
        coords: { tx: coords.tx, ty: coords.ty, px: coords.px, py: coords.py }
      }
    };
    Manager.worker.postMessage(message, [bitmap]);
    const result = await promise.catch(() => null);
    Manager.workerCreateTemplateResolve.delete(name);
    if (result === null) {
      return null;
    }
    template.tiles = /* @__PURE__ */ new Map();
    for (const [index, colors] of result.tiles) {
      const progress = /* @__PURE__ */ new Map();
      for (const [id, total] of colors) {
        progress.set(id, {
          total,
          unpainted: total,
          wrong: 0,
          unpaintedLocations: [],
          wrongLocations: []
        });
        template.totalProgress.total += total;
        template.totalProgress.unpainted += total;
      }
      template.tiles.set(index, progress);
    }
    return template;
  }
  static async fromStorage(stored) {
    if (stored.name === void 0 || stored.coords === void 0 || stored.width === void 0 || stored.height === void 0 || stored.base64Data === void 0 || stored.tiles === void 0)
      return null;
    const template = new _Template(stored.name, PixelCoords.copy(stored.coords), stored.width, stored.height);
    if (stored.enabled !== void 0)
      template.enabled = stored.enabled;
    template.base64Data = stored.base64Data;
    template.tiles = /* @__PURE__ */ new Map();
    for (const [index, colors] of stored.tiles) {
      const progress = /* @__PURE__ */ new Map();
      for (const [id, total] of colors) {
        progress.set(id, {
          total,
          unpainted: total,
          wrong: 0,
          unpaintedLocations: [],
          wrongLocations: []
        });
        template.totalProgress.total += total;
        template.totalProgress.unpainted += total;
      }
      template.tiles.set(index, progress);
    }
    const message = {
      name: "TemplateFromStorage",
      data: {
        name: template.name,
        width: template.width,
        height: template.height,
        coords: { tx: template.coords.tx, ty: template.coords.ty, px: template.coords.px, py: template.coords.py },
        base64Data: stored.base64Data
      }
    };
    Manager.worker.postMessage(message);
    return template;
  }
  overlaps(tile) {
    return this.tiles.has(tile);
  }
  overlapsPixel(pixel) {
    const ix = (pixel.tx - this.coords.tx) * 1e3 - this.coords.px + pixel.px;
    const iy = (pixel.ty - this.coords.ty) * 1e3 - this.coords.py + pixel.py;
    return ix >= 0 && ix < this.width && iy >= 0 && iy < this.height;
  }
  async drawOnTile(tile, ctx, trackProgress) {
    if (!this.enabled || !this.overlaps(tile.toIndex()))
      return;
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const canvasImageData = imageData.data;
    const { promise, resolve, reject } = Promise.withResolvers();
    setTimeout(reject, 10 * 1e3);
    const key = Math.random().toString();
    Manager.workerDrawOnTileResolve.set(key, resolve);
    const message = {
      name: "DrawOnTile",
      data: {
        name: this.name,
        tile: { x: tile.x, y: tile.y },
        key,
        patternSize: Manager.patternSize,
        trackProgress,
        enabled: Manager.enabledColors.entries().toArray(),
        modifyPixels: this.modifyPixels,
        canvasWidth: ctx.canvas.width,
        canvas: canvasImageData.buffer
      }
    };
    Manager.worker.postMessage(message, [canvasImageData.buffer]);
    const result = await promise.catch(() => null);
    Manager.workerDrawOnTileResolve.delete(key);
    if (result === null)
      return;
    this.modifyPixels = [];
    ctx.putImageData(new ImageData(new Uint8ClampedArray(result.canvas), ctx.canvas.width, ctx.canvas.height), 0, 0);
    if (trackProgress) {
      this.tiles.set(tile.toIndex(), new Map(result.colorsProgress));
      this.updateTotalProgress();
      updateTemplatePixelCount(this);
    }
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
function getZoomLevelForPixelSize(x) {
  return Math.log2(x / 100) + 18.6;
}
function functionBody(f) {
  return f.substring(f.indexOf("{") + 1, f.lastIndexOf("}"));
}
function twoDigits(n, radix = 10) {
  return n < radix ? "0" + n.toString(radix) : n.toString(radix);
}
function rgbToId(r, g, b) {
  return r * 1e3 * 1e3 + g * 1e3 + b;
}
function rgbToCss(rgb) {
  return twoDigits(rgb[0], 16) + twoDigits(rgb[1], 16) + twoDigits(rgb[2], 16);
}
var otherColor = { internalId: -1, id: rgbToId(136, 136, 136), name: "Other", rgb: [136, 136, 136], wplaceOrder: 64 };
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
    return 2;
  if (color.wplaceOrder === 63)
    return 3;
  return 0.299 * (color.rgb[0] / 255) + 0.587 * (color.rgb[1] / 255) + 0.114 * (color.rgb[2] / 255);
}
function computeHue(id) {
  const color = rgbColorMap.get(id);
  if (color === otherColor)
    return 361;
  if (color.wplaceOrder === 63)
    return 362;
  const [red, green, blue] = color.rgb;
  const min = Math.min(Math.min(red, green), blue);
  const max = Math.max(Math.max(red, green), blue);
  if (min === max)
    return 0;
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
rgbColorMap.set(otherColor.id, otherColor);

// dist/worker.js
function workerFunction() {
  let rgbColorMap2;
  let otherColor2;
  const transparentColorId = rgbToId2(222, 250, 206);
  function rgbToId2(r, g, b) {
    return r * 1e3 * 1e3 + g * 1e3 + b;
  }
  function closeEnough(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db <= 57;
  }
  function getColor2(r, g, b) {
    const id = rgbToId2(r, g, b);
    const color = rgbColorMap2.get(id);
    if (color !== void 0)
      return color;
    return otherColor2;
  }
  function getClosestColor(r, g, b, a) {
    const id = a < 32 ? transparentColorId : rgbToId2(r, g, b);
    const color = rgbColorMap2.get(id);
    if (color !== void 0)
      return color;
    for (const color2 of rgbColorMap2.values()) {
      if (closeEnough(r, g, b, ...color2.rgb))
        return color2;
    }
    return otherColor2;
  }
  Array.prototype.shuffle = function() {
    for (let i = this.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this[i];
      this[i] = this[j];
      this[j] = temp;
    }
    return this;
  };
  const templates = /* @__PURE__ */ new Map();
  self.onmessage = (e) => {
    const m = e.data;
    switch (m.name) {
      case "Init":
        rgbColorMap2 = new Map(m.data.rgbColorMap);
        otherColor2 = rgbColorMap2.get(rgbToId2(136, 136, 136));
        break;
      case "CreateTemplate":
        templateFromBitmap(m.data);
        break;
      case "TemplateFromStorage":
        templateFromBase64Data(m.data);
        break;
      case "ComputeBase64Data":
        computeBase64Data(m.data.name);
        break;
      case "DrawOnTile":
        drawOnTile(m.data);
        break;
      default:
        m;
    }
  };
  function templateFromBitmap({ name, bitmap, coords }) {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tiles = /* @__PURE__ */ new Map();
    for (let y = 0; y < imageData.height; y++)
      for (let x = 0; x < imageData.width; x++) {
        const pixelIndex = (y * imageData.width + x) * 4;
        if (imageData.data[pixelIndex + 3] < 128) {
          imageData.data[pixelIndex + 3] = 0;
          continue;
        }
        const tileIndex = (coords.tx + Math.floor((coords.px + x) / 1e3)) % 2048 * 1e4 + (coords.ty + Math.floor((coords.py + y) / 1e3)) % 2048;
        let tile = tiles.get(tileIndex);
        if (tile === void 0) {
          tile = /* @__PURE__ */ new Map();
          tiles.set(tileIndex, tile);
        }
        const color = getClosestColor(imageData.data[pixelIndex + 0], imageData.data[pixelIndex + 1], imageData.data[pixelIndex + 2], 255);
        tile.set(color.id, tile.get(color.id) ?? 0 + 1);
        if (color !== otherColor2) {
          imageData.data[pixelIndex + 0] = color.rgb[0];
          imageData.data[pixelIndex + 1] = color.rgb[1];
          imageData.data[pixelIndex + 2] = color.rgb[2];
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    templates.set(name, { imageData: imageData.data, width: canvas.width, height: canvas.height, coords });
    setTimeout(() => computeBase64Data(name));
    const response = {
      name: "CreateTemplate",
      data: {
        name,
        tiles: tiles.entries().toArray().map(([index, colors]) => [index, colors.entries().toArray()])
      }
    };
    self.postMessage(response);
  }
  function templateFromBase64Data({ name, width, height, coords, base64Data }) {
    try {
      const binary = atob(LZString.decompress(base64Data));
      const array = new Uint8ClampedArray(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      templates.set(name, { imageData: array, width, height, coords });
    } catch {
      const message = {
        name: "TemplateFromStorage",
        data: {
          name
        }
      };
      self.postMessage(message);
    }
  }
  function computeBase64Data(name) {
    const imageData = templates.get(name)?.imageData;
    if (imageData === void 0)
      return;
    let binary = "";
    for (let i = 0; i < imageData.length; i++) {
      binary += String.fromCharCode(imageData[i]);
    }
    const base64Data = LZString.compress(btoa(binary));
    const response = {
      name: "ComputeBase64Data",
      data: {
        name,
        base64Data
      }
    };
    self.postMessage(response);
  }
  function drawOnTile({ name, tile, key, patternSize, trackProgress, enabled, modifyPixels, canvasWidth, canvas }) {
    const template = templates.get(name);
    if (template === void 0)
      return;
    const enabledMap = new Map(enabled);
    let needToStoreTemplates = false;
    const canvasImageData = new Uint8ClampedArray(canvas);
    const isFirstX = template.coords.tx === tile.x;
    const isFirstY = template.coords.ty === tile.y;
    const colorsProgress = /* @__PURE__ */ new Map();
    for (let iy = isFirstY ? 0 : (tile.y - template.coords.ty) * 1e3 - template.coords.py, cy = isFirstY ? template.coords.py : 0; iy < template.height && cy < 1e3; iy++, cy++)
      for (let ix = isFirstX ? 0 : (tile.x - template.coords.tx) * 1e3 - template.coords.px, cx = isFirstX ? template.coords.px : 0; ix < template.width && cx < 1e3; ix++, cx++) {
        const imagePixelIndex = (iy * template.width + ix) * 4;
        const canvasPixelIndex = ((cy * patternSize + 1) * canvasWidth + cx * patternSize + 1) * 4;
        if (template.imageData[imagePixelIndex + 3] === 0)
          continue;
        let color = getColor2(template.imageData[imagePixelIndex + 0], template.imageData[imagePixelIndex + 1], template.imageData[imagePixelIndex + 2]);
        const paintedColor = getClosestColor(canvasImageData[canvasPixelIndex + 0], canvasImageData[canvasPixelIndex + 1], canvasImageData[canvasPixelIndex + 2], canvasImageData[canvasPixelIndex + 3]);
        const pixelTileIndex = (tile.x * 1e4 + tile.y) * 1e6 + (cx * 1e3 + cy);
        if (modifyPixels.includes(pixelTileIndex)) {
          if (color !== paintedColor) {
            needToStoreTemplates = true;
            color = paintedColor;
            template.imageData[imagePixelIndex + 0] = paintedColor.rgb[0];
            template.imageData[imagePixelIndex + 1] = paintedColor.rgb[1];
            template.imageData[imagePixelIndex + 2] = paintedColor.rgb[2];
            template.imageData[imagePixelIndex + 3] = 255;
          }
        }
        if (trackProgress) {
          let progress = colorsProgress.get(color.id);
          if (progress === void 0) {
            progress = {
              total: 0,
              unpainted: 0,
              wrong: 0,
              unpaintedLocations: [],
              wrongLocations: []
            };
            colorsProgress.set(color.id, progress);
          }
          progress.total++;
          if (color.id !== transparentColorId && canvasImageData[canvasPixelIndex + 3] === 0) {
            progress.unpainted++;
            progress.unpaintedLocations.push(pixelTileIndex);
          } else if (color !== paintedColor) {
            progress.wrong++;
            progress.wrongLocations.push(pixelTileIndex);
          }
        }
        if (enabledMap.get(color.id)) {
          if (color.id === transparentColorId) {
            if (canvasImageData[canvasPixelIndex + 3] > 0)
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                  const idx = ((cy * patternSize + 1 + dy) * canvasWidth + cx * patternSize + 1 + dx) * 4;
                  const c = (cx + dx + cy + dy) % 2 == 0 ? 0 : 255;
                  canvasImageData[idx + 0] = (paintedColor.rgb[0] * 207 + c * 48) / 255;
                  canvasImageData[idx + 1] = (paintedColor.rgb[1] * 207 + c * 48) / 255;
                  canvasImageData[idx + 2] = (paintedColor.rgb[2] * 207 + c * 48) / 255;
                }
          } else {
            canvasImageData[canvasPixelIndex + 0] = template.imageData[imagePixelIndex + 0];
            canvasImageData[canvasPixelIndex + 1] = template.imageData[imagePixelIndex + 1];
            canvasImageData[canvasPixelIndex + 2] = template.imageData[imagePixelIndex + 2];
            canvasImageData[canvasPixelIndex + 3] = template.imageData[imagePixelIndex + 3];
          }
        }
      }
    if (needToStoreTemplates)
      setTimeout(() => computeBase64Data(name));
    colorsProgress.forEach((t) => {
      t.unpaintedLocations.shuffle().splice(100);
      t.wrongLocations.shuffle().splice(100);
    });
    const message = {
      name: "DrawOnTile",
      data: {
        key,
        colorsProgress: colorsProgress.entries().toArray(),
        canvas: canvasImageData.buffer
      }
    };
    self.postMessage(message, [canvasImageData.buffer]);
  }
}

// dist/Manager.js
var ManagerClass = class _ManagerClass {
  patternSize = 3;
  templates;
  tilesInfo;
  enabledColors;
  teleportCurrentIndex;
  lastClickedCoords;
  loggedIn;
  userFullCharges;
  settings;
  wplaceMap;
  worker;
  workerCreateTemplateResolve;
  workerDrawOnTileResolve;
  setInputCoords(value, store = true) {
    document.getElementById("ca-input-tx").value = value?.tx.toString() ?? "";
    document.getElementById("ca-input-ty").value = value?.ty.toString() ?? "";
    document.getElementById("ca-input-px").value = value?.px.toString() ?? "";
    document.getElementById("ca-input-py").value = value?.py.toString() ?? "";
    if (store)
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
    this.teleportCurrentIndex = 0;
    this.lastClickedCoords = null;
    this.loggedIn = false;
    this.userFullCharges = /* @__PURE__ */ new Date();
    this.settings = {
      colorSorting: "Total",
      colorSortingReversed: false,
      uiSize: "100",
      hideCompleted: false
    };
    this.wplaceMap = null;
    this.workerCreateTemplateResolve = /* @__PURE__ */ new Map();
    this.workerDrawOnTileResolve = /* @__PURE__ */ new Map();
  }
  static #loadValue(key) {
    return JSON.parse(GM_getValue(key, null));
  }
  static #storeValue(key, value) {
    GM_setValue(key, JSON.stringify(value));
  }
  loadGlobals() {
    const stored = _ManagerClass.#loadValue("global");
    if (stored == null)
      return;
    if (stored.inputCoords != null) {
      this.lastClickedCoords = PixelCoords.copy(stored.inputCoords);
      this.setInputCoords(this.lastClickedCoords, false);
    }
    if (stored.settings !== void 0) {
      if (stored.settings.colorSorting !== void 0)
        this.settings.colorSorting = stored.settings.colorSorting;
      document.getElementById("ca-sort-select").value = this.settings.colorSorting;
      if (stored.settings.colorSortingReversed !== void 0)
        this.settings.colorSortingReversed = stored.settings.colorSortingReversed;
      if (stored.settings.uiSize !== void 0)
        this.settings.uiSize = stored.settings.uiSize;
      document.getElementById("ca-setting-ui-size").value = this.settings.uiSize;
      document.getElementById("ca-overlay").style.setProperty("--ca-ui-size", this.settings.uiSize + "%");
      if (stored.settings.hideCompleted !== void 0)
        this.settings.hideCompleted = stored.settings.hideCompleted;
      document.getElementById("ca-setting-hide-completed").checked = this.settings.hideCompleted;
    }
    if (stored.enabledColors !== void 0)
      this.enabledColors = new Map(stored.enabledColors);
  }
  storeGlobal(overrides) {
    _ManagerClass.#storeValue("global", {
      inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
      settings: this.settings,
      enabledColors: this.enabledColors.entries().toArray()
    });
  }
  async loadTemplates() {
    const stored = _ManagerClass.#loadValue("templates");
    if (!stored)
      return;
    for (const template of this.templates)
      removeTemplateRow(template.name);
    this.templates = [];
    this.tilesInfo.clear();
    for (const storedTemplate of stored) {
      const template = await Template.fromStorage(storedTemplate);
      if (template === null)
        continue;
      this.templates.push(template);
      addTemplateRow(template);
    }
    this.rebuildColorList();
    displayStatus("Loaded " + this.templates.length + " templates");
  }
  storeTemplates() {
    _ManagerClass.#storeValue("templates", this.templates);
  }
  deleteTiles(indices) {
    if (indices === void 0)
      indices = this.tilesInfo.keys();
    else if (typeof indices !== "object" || !(Symbol.iterator in indices)) {
      indices = [indices];
    }
    for (const index of indices)
      this.tilesInfo.delete(index);
    this.wplaceMap?.refreshTiles("pixel-art-layer");
  }
  refreshTiles(indices, trackProgress) {
    if (indices === void 0)
      indices = this.tilesInfo.keys();
    else if (typeof indices !== "object" || !(Symbol.iterator in indices)) {
      indices = [indices];
    }
    for (const index of indices) {
      const info = this.tilesInfo.get(index);
      if (info !== void 0)
        info.shouldUseOrig = trackProgress ? 2 : 1;
    }
    this.wplaceMap?.refreshTiles("pixel-art-layer");
  }
  async createWorker() {
    const lzstring = await fetch("https://cdn.jsdelivr.net/gh/pieroxy/lz-string/libs/lz-string.min.js").then((r) => r.text());
    const script = lzstring + functionBody(workerFunction.toString());
    const blob = new Blob([script], { type: "text/javascript" });
    const blobURL = URL.createObjectURL(blob);
    this.worker = new unsafeWindow.Worker(blobURL);
    URL.revokeObjectURL(blobURL);
    this.worker.onmessage = _ManagerClass.workerMessage;
    this.workerInit();
  }
  static workerMessage(e) {
    const m = e.data;
    switch (m.name) {
      case "CreateTemplate":
        Manager.workerCreateTemplateResolve.get(m.data.name)?.(m.data);
        break;
      case "TemplateFromStorage":
        const index = Manager.templates.findIndex((t) => t.name === m.data.name);
        if (index !== -1)
          Manager.deleteTemplate(index);
        break;
      case "ComputeBase64Data":
        const template = Manager.templates.find((t) => t.name === m.data.name);
        if (template === void 0)
          break;
        template.base64Data = m.data.base64Data;
        Manager.storeTemplates();
        break;
      case "DrawOnTile":
        Manager.workerDrawOnTileResolve.get(m.data.key)?.(m.data);
        break;
      default:
        m;
    }
  }
  workerInit() {
    const initMessage = {
      name: "Init",
      data: {
        rgbColorMap: rgbColorMap.entries().toArray().map(([id, c]) => [id, { id: c.id, rgb: c.rgb }])
      }
    };
    this.worker.postMessage(initMessage);
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
    displayStatus("Creating template...");
    const start = performance.now();
    const template = await Template.fromFile(name, coords, file);
    const time = performance.now() - start;
    console.log("Created template in " + time + "ms");
    if (template === null) {
      displayStatus("Failed creating template");
      return;
    }
    this.refreshTiles(template.tiles.keys());
    this.templates.push(template);
    addTemplateRow(template);
    this.rebuildColorList();
    displayStatus("Created template at " + template.coords.toString() + ": " + template.totalProgress.total + " pixels");
  }
  deleteTemplate(index) {
    const template = this.templates[index];
    if (template === void 0)
      return;
    this.deleteTiles(template.tiles.keys());
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
    let anyWrong = false;
    for (const template of this.templates) {
      if (template.enabled)
        for (const [_, colors] of template.tiles)
          for (const [id, progress] of colors) {
            if (progress.total === 0)
              continue;
            let totalProgress = colorProgress.get(id);
            if (totalProgress === void 0) {
              totalProgress = { total: 0, unpainted: 0, wrong: 0 };
              colorProgress.set(id, totalProgress);
            }
            totalProgress.total += progress.total;
            totalProgress.unpainted += progress.unpainted;
            totalProgress.wrong += progress.wrong;
            if (totalProgress.wrong > 0)
              anyWrong = true;
          }
    }
    for (const id of this.enabledColors.keys()) {
      if (!colorProgress.has(id))
        this.enabledColors.delete(id);
    }
    const colorsArray = colorProgress.entries().toArray();
    switch (this.settings.colorSorting) {
      case "Total":
        colorsArray.sort((a, b) => b[1].total - a[1].total);
        break;
      case "Remaining":
        colorsArray.sort((a, b) => b[1].unpainted + b[1].wrong - a[1].unpainted - a[1].wrong);
        break;
      case "Wrong":
        colorsArray.sort((a, b) => b[1].wrong - a[1].wrong);
        break;
      case "Progress":
        colorsArray.sort((a, b) => (b[1].total - b[1].unpainted - b[1].wrong) / b[1].total - (a[1].total - a[1].unpainted - a[1].wrong) / a[1].total);
        break;
      case "Original":
        colorsArray.sort((a, b) => rgbColorMap.get(a[0]).wplaceOrder - rgbColorMap.get(b[0]).wplaceOrder);
        break;
      case "Luminance":
        colorsArray.sort((a, b) => computeLuminance(a[0]) - computeLuminance(b[0]));
        break;
      case "Hue":
        colorsArray.sort((a, b) => {
          const d = computeHue(b[0]) - computeHue(a[0]);
          if (d !== 0)
            return d;
          return computeLuminance(a[0]) - computeLuminance(b[0]);
        });
        break;
      default:
        this.settings.colorSorting;
    }
    if (this.settings.colorSortingReversed)
      colorsArray.reverse();
    for (const [id, progress] of colorsArray) {
      if (!this.enabledColors.has(id))
        this.enabledColors.set(id, true);
      if (!this.settings.hideCompleted || (this.settings.colorSorting === "Wrong" && anyWrong ? 0 : progress.unpainted) + progress.wrong > 0)
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
        shouldUseOrig: 0,
        origBlob: null,
        fullBlob: null
      };
      this.tilesInfo.set(tileIndex, tileInfo);
    }
    let modifiedBlob = tileInfo.fullBlob;
    if (modifiedBlob === null || tileInfo.lastModified < lastModified || response.type === "basic") {
      const blob = await response.blob();
      const trackProgress = response.type !== "basic" || modifiedBlob === null;
      modifiedBlob = await this.drawOnTile(tile, blob, trackProgress);
      if (trackProgress) {
        this.rebuildColorList();
        tileInfo.origBlob = blob;
        tileInfo.fullBlob = modifiedBlob;
        tileInfo.lastModified = lastModified;
      }
    }
    return new Response(modifiedBlob, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  }
  async processTileFromOrig(tile) {
    const tileInfo = this.tilesInfo.get(tile.toIndex());
    const trackProgress = tileInfo.shouldUseOrig === 2;
    tileInfo.shouldUseOrig = 0;
    const modifiedBlob = await this.drawOnTile(tile, tileInfo.origBlob, trackProgress);
    tileInfo.fullBlob = modifiedBlob;
    return new Response(modifiedBlob, {
      headers: new Headers([["content-type", "image/png"], ["content-length", modifiedBlob.size.toString()]]),
      status: 200
    });
  }
  async drawOnTile(tile, blob, trackProgress) {
    let allDisabled = true;
    for (const enabled of this.enabledColors.values()) {
      if (enabled === true) {
        allDisabled = false;
        break;
      }
    }
    if (allDisabled && !trackProgress)
      return blob;
    let canvas = new OffscreenCanvas(this.patternSize * 1e3, this.patternSize * 1e3);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);
    for (const template of this.templates)
      if (template.enabled)
        await template.drawOnTile(tile, ctx, trackProgress);
    return await canvas.convertToBlob();
  }
  /* Snipet inspired from https://github.com/t-wy/Wplace-BlueMarble-Userscripts/tree/custom-improve */
  async getMapObject() {
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
    let i = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 500));
      canvas = document.querySelector("canvas.maplibregl-canvas");
      i++;
    } while (canvas === null && i < 20);
    if (canvas === null)
      return;
    let popup = null;
    while (popup === null) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        button: 0
      });
      canvas.dispatchEvent(clickEvent);
      let i2 = 0;
      do {
        await new Promise((resolve) => setTimeout(resolve, 50));
        popup = document.getElementsByClassName("rounded-t-box bg-base-100 border-base-300 sm:rounded-b-box w-full border-t bg-cover bg-center pt-2 sm:mb-3 sm:shadow-xl")[0]?.querySelector('[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"]')?.parentElement?.parentElement;
        i2++;
      } while (popup == null && i2 < 10);
    }
    popup.click();
  }
  flyTo(center, zoom = 13) {
    this.wplaceMap?.flyTo({ center, zoom });
  }
  flyToFit(topLeft, width, height, extraProportion = 1.1) {
    if (this.wplaceMap === null)
      return;
    const canvas = document.getElementsByClassName("maplibregl-canvas")[0];
    if (canvas === void 0)
      return;
    const xZoom = getZoomLevelForPixelSize(canvas.clientWidth / width / extraProportion);
    const yZoom = getZoomLevelForPixelSize(canvas.clientHeight / height / extraProportion);
    const finalZoom = Math.max(10.7, Math.min(18, xZoom, yZoom));
    this.flyTo(new PixelCoords(topLeft.tx, topLeft.ty, topLeft.px + width / 2, topLeft.py + height / 2).toGeoCoords(false), finalZoom);
  }
  flyToNextIncorrect(t) {
    let picked;
    const prng = splitmix32(t.wrongLocations.length + t.unpaintedLocations.length);
    for (let i = t.wrongLocations.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      const temp = t.wrongLocations[i];
      t.wrongLocations[i] = t.wrongLocations[j];
      t.wrongLocations[j] = temp;
    }
    for (let i = t.unpaintedLocations.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      const temp = t.unpaintedLocations[i];
      t.unpaintedLocations[i] = t.unpaintedLocations[j];
      t.unpaintedLocations[j] = temp;
    }
    if (t.wrongLocations.length > 0) {
      this.teleportCurrentIndex = (this.teleportCurrentIndex + 1) % t.wrongLocations.length;
      picked = t.wrongLocations[this.teleportCurrentIndex];
    } else if (t.unpaintedLocations.length > 0) {
      this.teleportCurrentIndex = (this.teleportCurrentIndex + 1) % t.unpaintedLocations.length;
      picked = t.unpaintedLocations[this.teleportCurrentIndex];
    } else
      return;
    this.flyTo(PixelCoords.fromIndex(picked).toGeoCoords(true), 17.5);
  }
};
var Manager = new ManagerClass();

// dist/display.js
function hehe(s) {
  return s.toString().replaceAll("69", '<img class="ca-hehe" src="https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_48b39bc882fd42f6b669d41e4053a36e/default/light/1.0">');
}
function injectOverlay() {
  document.body.appendChild(document.createElement("div")).outerHTML = `
<div id="ca-overlay" style="--ca-ui-size: 100%;">
    <template id="ca-coords-template">
        <div class="ca-display-coords">
            <span>Tile X: 1056, Tile Y: 714 ; Pixel X: 304, Pixel Y: 744</span>
            <button class="tooltip ca-mark-as-correct" data-tip="Edit the template by marking this pixel as being correct">Mark as correct</button>
        </div>
    </template>
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
                <div>
                    <button class="ca-icon-button ca-template-fly">✈️</button>
                    <button class="ca-icon-button ca-template-copy">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M11 7h6v6h-6z" />
                            <path d="M6.5 3h8.1c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v7.1M6.2 21h8.1c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874c.218-.428.218-.988.218-2.108V9.7c0-1.12 0-1.68-.218-2.108a2 2 0 0 0-.874-.874C15.98 6.5 15.42 6.5 14.3 6.5H6.2c-1.12 0-1.68 0-2.108.218a2 2 0 0 0-.874.874C3 8.02 3 8.58 3 9.7v8.1c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21" stroke-width="2" stroke-linecap="round" />
                        </svg>
                    </button>
                    <button class="ca-icon-button ca-teleport-incorrect">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
                            <path d="M300-240q25 0 42.5-17.5T360-300t-17.5-42.5T300-360t-42.5 17.5T240-300t17.5 42.5T300-240m0-360q25 0 42.5-17.5T360-660t-17.5-42.5T300-720t-42.5 17.5T240-660t17.5 42.5T300-600m180 180q25 0 42.5-17.5T540-480t-17.5-42.5T480-540t-42.5 17.5T420-480t17.5 42.5T480-420m180 180q25 0 42.5-17.5T720-300t-17.5-42.5T660-360t-42.5 17.5T600-300t17.5 42.5T660-240m0-360q25 0 42.5-17.5T720-660t-17.5-42.5T660-720t-42.5 17.5T600-660t17.5 42.5T660-600M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120zm0-80h560v-560H200zm0-560v560z"></path>
                        </svg>
                    </button>
                </div>
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
        <button id="ca-fly-hq" class="ca-icon-button">✈️</button>
    </div>
    <hr />
    <div id="ca-user-info" style="display: none;">
        <p>Username: <b id="ca-user-name"></b></p>
        <p>Droplets: <b id="ca-user-droplets"></b></p>
        <p>Level <b id="ca-user-level">0</b> in <b id="ca-user-pixels">0</b> pixels</p>
        <p>Full charges in <b id="ca-user-charges" class="tooltip"></b></p>
        <hr />
    </div>
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
                UI size
                <input id="ca-setting-ui-size" type="range" min="40" max="100" step="10">
            </div>
            <div>
                Hide completed colors
                <input id="ca-setting-hide-completed" type="checkbox">
            </div>
        </div>
        <div id="ca-sorting">
            Sort:
            <select id="ca-sort-select">
                <option value="Total">Total pixels</option>
                <option value="Remaining">Remaining pixels</option>
                <option value="Wrong">Wrong pixels</option>
                <option value="Progress">Progress %</option>
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
                Enable all
            </button>
            <button id="ca-disable-all" class="tooltip">
                <div class="tooltip-content">
                    <kbd class="kbd kbd-xs text-base-content touchscreen:hidden ml-0.5 rounded-md">D</kbd>
                </div>
                Disable all
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
.ca-display-coords {
    font-size: 11px;
    padding-inline: calc(var(--spacing)*1.5);
}

.ca-mark-as-correct {
    background-color: #cb4334;
    border-radius: 1em;
    margin-left: 1ch;
    padding: 0 0.5ch;
}
.ca-mark-as-correct:hover, .ca-mark-as-correct:focus-visible {
    background-color: #d16458;
}
.ca-mark-as-correct:active {
    background-color: #d68d85;
}
.ca-mark-as-correct:disabled {
    background-color: #d68d85;
    cursor: not-allowed;
}
.ca-mark-as-correct::before {
    font-size: 12px;
}

#ca-overlay {
    background-color: #5D1F18E6;
    border-radius: 0.5em;
    color: white;
    font-size: var(--ca-ui-size);
    max-height: 100%;
    max-width: 19em;
    padding: 0.625em;
    position: absolute;
    right: 75px;
    top: 10px;
    transition:
        max-height 500ms,
        max-width 500ms,
        z-index 200ms;
    width: auto;
    white-space: nowrap;
    z-index: 49;
}

/* Go behind other popups when not hovering a tooltip */
#ca-overlay:not(:has(.tooltip:hover)) {
    z-index: 29;
}

/* Collapsing */
#ca-overlay.collapsed {
    max-width: 3.75em;
    max-height: 3.75em;
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
    font-size: 150%;
    font-weight: bold;
    vertical-align: middle;
}

#ca-overlay hr {
    margin: 0.5em 0;
}

#ca-overlay small {
    font-size: 75%;
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

#ca-overlay input[type="checkbox"] {
    height: 1.2em;
}
#ca-overlay input[type="range"] {
    height: 2em;
    flex: 1 0 auto;
    zoom: var(--ca-ui-size);
}

#ca-overlay select {
    border: white 1px solid;
    border-radius: 0.5em;
    background-color: #ab2314;
    font-size: 81%;
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

.ca-hehe {
    display: inline;
    height: 1.5em;
}
#ca-overlay span:has(> .ca-hehe) {
    display: inline-flex;
}

#ca-header {
    align-items: center;
    display: flex;
    gap: 1ch;
    justify-content: space-between;
}

#ca-image-collapse {
    border-radius: 0.75em;
    cursor: pointer;
    height: 2.5em;
}

#ca-user-info > p {
    height: 1.5em;
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
    font-size: 81%;
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
    align-items: center;
    display: flex;
    gap: 1ch;
    justify-content: space-between;
    width: 100%;
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
    stroke-width: 0.625em;
}

#ca-color-list {
    background-color: #00000022;
    border-color: black;
    border-radius: .3em;
    border-width: 1px;
    font-size: 75%;
    margin-top: 0.5em;
    max-height: 10em;
    overflow: auto;
    padding: 0.42em;
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
    max-height: 10.1em;
    overflow: auto;
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
.ca-template-copy {
    margin-left: 0.5ch;
}
.ca-template-copy > svg {
    fill: white;
    stroke: #111;
    transition-property: fill;
    transition-duration: 250ms;
    width: 70%;
}
.ca-teleport-incorrect {
    margin-left: 0.5ch;
}
.ca-teleport-incorrect > svg {
    width: 87%;
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
    align-items: center;
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
    font-size: 81%;
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
async function addAllianceButtonBack() {
  const container = document.getElementsByClassName("absolute top-2 right-2 z-40")[0]?.firstElementChild;
  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes)
          if (node.classList.contains("flex")) {
            const firstButton = node.firstElementChild;
            if (firstButton === null || firstButton.classList.contains("not-touchscreen:hidden"))
              continue;
            const allianceButton = firstButton?.cloneNode(true);
            if (allianceButton === void 0)
              continue;
            allianceButton.title = "Alliance";
            allianceButton.querySelector("svg").innerHTML = '<path d="M40-160v-160q0-34 23.5-57t56.5-23h131q20 0 38 10t29 27q29 39 71.5 61t90.5 22q49 0 91.5-22t70.5-61q13-17 30.5-27t36.5-10h131q34 0 57 23t23 57v160H640v-91q-35 25-75.5 38T480-200q-43 0-84-13.5T320-252v92H40Zm440-160q-38 0-72-17.5T351-386q-17-25-42.5-39.5T253-440q22-37 93-58.5T480-520q63 0 134 21.5t93 58.5q-29 0-55 14.5T609-386q-22 32-56 49t-73 17ZM160-440q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T280-560q0 50-34.5 85T160-440Zm640 0q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T920-560q0 50-34.5 85T800-440ZM480-560q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-680q0 50-34.5 85T480-560Z"></path>';
            allianceButton.addEventListener("click", () => {
              document.getElementsByClassName("flex w-full max-w-full flex-col gap-1.5 overflow-x-clip pr-1")[0]?.children[1]?.click();
            });
            node.insertBefore(allianceButton, firstButton.title === "Store" ? firstButton.nextElementSibling : firstButton);
          }
      }
    }
  });
  observer.observe(container, { childList: true });
}
function displayFullCharges() {
  const ms = Math.max(0, Manager.userFullCharges.getTime() - Date.now());
  const s = ms / 1e3;
  let text;
  if (s > 3600)
    text = `${twoDigits(Math.floor(s / 3600))}h${twoDigits(Math.floor(s / 60) % 60)}m`;
  else
    text = `${twoDigits(Math.floor(s / 60))}m${twoDigits(Math.floor(s) % 60)}s`;
  document.getElementById("ca-user-charges").innerText = text;
  if (s > 3601)
    setTimeout(displayFullCharges, ms % 6e4);
  else
    setTimeout(displayFullCharges, ms % 1e3);
}
function displayUserData(data) {
  const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), 1 / 0.65) - data.pixelsPainted);
  Manager.userFullCharges = new Date(Date.now() + (data.charges.max - data.charges.count) * data.charges.cooldownMs);
  const username = document.getElementById("ca-user-name");
  if (username !== null) {
    username.innerText = data.name;
    document.getElementById("ca-user-droplets").innerHTML = hehe(data.droplets.toLocaleString());
    document.getElementById("ca-user-level").innerHTML = hehe(Math.floor(data.level + 1).toLocaleString());
    document.getElementById("ca-user-pixels").innerHTML = hehe(nextLevelPixels.toLocaleString());
    document.getElementById("ca-user-charges").setAttribute("data-tip", Manager.userFullCharges.toLocaleString());
    displayFullCharges();
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
  enable.checked = Manager.enabledColors.get(colorId) === true;
  enable.addEventListener("change", (e) => {
    Manager.enabledColors.set(colorId, e.target.checked);
    Manager.refreshTiles();
    Manager.storeGlobal();
  });
  const color = row.querySelector(".ca-color-display");
  color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;
  color.addEventListener("click", (e) => {
    [...document.getElementsByClassName("ca-color-row")].forEach((r) => r.firstElementChild.checked = false);
    e.target.previousElementSibling.checked = true;
    Manager.enabledColors.forEach((_, key) => Manager.enabledColors.set(key, key === colorId));
    Manager.refreshTiles();
    Manager.storeGlobal();
  });
  const paint = row.querySelector("button");
  if (!Manager.loggedIn)
    paint.style.display = "none";
  paint.title = "Double click to teleport to an incorrect pixel";
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
    const all = Manager.templates.filter((t) => t.enabled).map((x) => x.tiles.values().toArray()).flat().map((x) => x.get(colorId)).filter((x) => x !== void 0).reduce((acc, curr) => {
      acc.unpaintedLocations.push(...curr.unpaintedLocations);
      acc.wrongLocations.push(...curr.wrongLocations);
      return acc;
    }, { unpaintedLocations: [], wrongLocations: [] });
    Manager.flyToNextIncorrect(all);
  });
  let countToShow;
  switch (Manager.settings.colorSorting) {
    case "Total":
      countToShow = progress.total;
      break;
    case "Remaining":
    case "Original":
    case "Luminance":
    case "Hue":
      countToShow = progress.unpainted + progress.wrong;
      break;
    case "Wrong":
      countToShow = progress.wrong;
      break;
    case "Progress":
      countToShow = Math.round((progress.total - progress.unpainted - progress.wrong) / progress.total * 100) + "%";
      break;
    default:
      return Manager.settings.colorSorting;
  }
  row.querySelector(".ca-color-count").innerHTML = hehe(countToShow);
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
    Manager.flyToFit(template.coords, template.width, template.height);
  });
  const copy = row.querySelector(".ca-template-copy");
  copy.addEventListener("click", async (e) => {
    const s = `${template.coords.tx} ${template.coords.ty} ${template.coords.px} ${template.coords.py}`;
    await navigator.clipboard.writeText(s);
    const target = e.target;
    const svg = target.tagName.toLowerCase() === "path" ? target.parentElement : target.firstElementChild;
    if (svg !== null) {
      svg.style.fill = "#2b8f1f";
      setTimeout(() => svg.style.fill = "", 500);
    }
  });
  const teleport = row.querySelector(".ca-teleport-incorrect");
  teleport.addEventListener("click", () => {
    const all = template.tiles.values().toArray().map((x) => x.values().toArray()).flat().reduce((acc, curr) => {
      acc.unpaintedLocations.push(...curr.unpaintedLocations);
      acc.wrongLocations.push(...curr.wrongLocations);
      return acc;
    }, { unpaintedLocations: [], wrongLocations: [] });
    Manager.flyToNextIncorrect(all);
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
    Manager.deleteTiles(template.tiles.keys());
    Manager.rebuildColorList();
    Manager.storeTemplates();
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
    count.innerHTML = `${hehe(painted)} / ${hehe(template.totalProgress.total)} (${hehe(Math.round(painted / template.totalProgress.total * 1e3) / 10)}%)`;
    const wrong = row.querySelector(".ca-wrong-count");
    wrong.innerHTML = template.totalProgress.wrong > 0 ? ` \u2022 ${hehe(template.totalProgress.wrong)}\u274C` : "";
  }
}
function removeTemplateRow(name) {
  document.getElementById(`ca-template-id-${name}`)?.remove();
}
function clickCloseButton() {
  const buttons = document.querySelectorAll('[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"]');
  buttons[buttons.length - 1]?.parentElement?.parentElement?.click();
}
function displayTileCoords(coords) {
  const textCoords = `Tile X: ${coords.tx}, Tile Y: ${coords.ty} ; Pixel X: ${coords.px}, Pixel Y: ${coords.py}`;
  const displayCoords = document.getElementsByClassName("ca-display-coords")[0];
  if (displayCoords !== void 0)
    displayCoords.remove();
  const buttonsDiv = document.getElementsByClassName("mt-auto flex w-full justify-between")[0];
  if (buttonsDiv === void 0)
    return;
  const template = document.getElementById("ca-coords-template").content.cloneNode(true);
  const span = template.querySelector("span");
  span.textContent = textCoords;
  const button = template.querySelector("button");
  const templateToModify = Manager.templates.findLast((t) => t.enabled && t.overlapsPixel(coords));
  const pixelIndex = coords.toIndex();
  if (templateToModify === void 0) {
    button.style.display = "none";
  } else if (templateToModify.modifyPixels.includes(pixelIndex)) {
    button.disabled = true;
  } else {
    button.addEventListener("click", () => {
      templateToModify.modifyPixels.push(pixelIndex);
      Manager.refreshTiles(coords.toTileIndex(), true);
      button.disabled = true;
      clickCloseButton();
    });
  }
  buttonsDiv.parentElement?.insertBefore(template, buttonsDiv);
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
        if (!Manager.loggedIn)
          break;
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
        if (!Manager.loggedIn)
          break;
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
        clickCloseButton();
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
  document.getElementById("ca-fly-hq").addEventListener("click", () => {
    Manager.flyToFit(new PixelCoords(1054, 713, 152, 468), 2457, 1566, 1);
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
  document.getElementById("ca-setting-ui-size").addEventListener("change", (e) => {
    Manager.settings.uiSize = e.target.value;
    Manager.storeGlobal();
    const overlay = document.getElementById("ca-overlay");
    overlay.style.transition = "none";
    overlay.style.setProperty("--ca-ui-size", Manager.settings.uiSize + "%");
    setTimeout(() => document.getElementById("ca-overlay").style.transition = "", 100);
  });
  document.getElementById("ca-setting-hide-completed").addEventListener("change", (e) => {
    Manager.settings.hideCompleted = e.target.checked;
    Manager.storeGlobal();
    Manager.rebuildColorList();
  });
  document.getElementById("ca-sort-select").addEventListener("change", (e) => {
    Manager.settings.colorSorting = e.target.value;
    Manager.storeGlobal();
    Manager.rebuildColorList();
  });
  document.getElementById("ca-sort-reverse").addEventListener("click", () => {
    Manager.settings.colorSortingReversed = !Manager.settings.colorSortingReversed;
    Manager.storeGlobal();
    Manager.rebuildColorList();
  });
  document.getElementById("ca-enable-all").addEventListener("click", () => {
    Manager.enabledColors.keys().forEach((id) => {
      Manager.enabledColors.set(id, true);
      const checkbox = document.getElementById("ca-color-id-" + id)?.firstElementChild;
      if (checkbox !== void 0)
        checkbox.checked = true;
    });
    Manager.refreshTiles();
    Manager.storeGlobal();
  });
  document.getElementById("ca-disable-all").addEventListener("click", () => {
    Manager.enabledColors.keys().forEach((id) => {
      Manager.enabledColors.set(id, false);
      const checkbox = document.getElementById("ca-color-id-" + id)?.firstElementChild;
      if (checkbox !== void 0)
        checkbox.checked = false;
    });
    Manager.refreshTiles();
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
    Manager.enabledColors.keys().forEach((id) => {
      const checkbox = document.getElementById("ca-color-id-" + id)?.firstElementChild;
      if (id === color.id) {
        inPalette = true;
        Manager.enabledColors.set(id, true);
        if (checkbox !== void 0) {
          checkbox.checked = true;
          checkbox.scrollIntoView({ "behavior": "smooth", "block": "center" });
        } else {
          displayStatus("Selected color is already completed");
        }
      } else {
        Manager.enabledColors.set(id, false);
        if (checkbox !== void 0)
          checkbox.checked = false;
      }
    });
    if (!inPalette)
      displayStatus(`${color.name} is not in palette`);
    Manager.refreshTiles();
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
  document.getElementById("ca-create-button").addEventListener("click", async (e) => {
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
    await Manager.createTemplate(coords, fileInput.files[0]);
    e.target.disabled = false;
  });
  document.getElementById("ca-converter-button").addEventListener("click", () => {
    window.open("https://pepoafonso.github.io/color_converter_wplace/", "_blank", "noopener noreferrer");
  });
}

// dist/app.js
await Manager.createWorker();
Manager.getMapObject();
importFont();
injectOverlay();
addAllianceButtonBack();
addListeners();
Manager.loadGlobals();
await Manager.loadTemplates();
document.getElementById("ca-version").innerText = "version " + GM_info.script.version;
setInterval(() => {
  if (!Manager.loggedIn) {
    unsafeWindow.fetch("https://backend.wplace.live/me", { credentials: "include" });
  }
}, 1e4);
var originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function(input, init) {
  const url = input instanceof Request ? input.url : input;
  const method = init?.method ?? "GET";
  if (url.includes("/tiles/") && method === "GET") {
    const coords = parseTileCoordsFromURL(url);
    const tileIndex = coords.toIndex();
    const tileInfo = Manager.tilesInfo.get(tileIndex);
    if (tileInfo?.shouldUseOrig && tileInfo.origBlob !== null) {
      const start = performance.now();
      const modified = await Manager.processTileFromOrig(coords);
      const time = performance.now() - start;
      if (time >= 2)
        console.log("Processed tile" + coords.toString() + " in " + time + "ms");
      return modified;
    }
  }
  const response = await originalFetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && url.endsWith("/me") && method === "GET") {
    const json = await response.clone().json();
    if (json.status && json.status.toString()[0] !== "2") {
      displayStatus("Could not fetch user data, are you logged in?");
      document.querySelectorAll(".ca-color-row button").forEach((b) => b.style.display = "none");
      document.getElementById("ca-user-info").style.display = "none";
      Manager.loggedIn = false;
    } else {
      displayUserData(json);
      document.querySelectorAll(".ca-color-row button").forEach((b) => b.style.display = "");
      document.getElementById("ca-user-info").style.display = "";
      Manager.loggedIn = true;
    }
  } else if (contentType.includes("application/json") && url.includes("/pixel/")) {
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
    if (time >= 2)
      console.log("Processed tile" + coords.toString() + " in " + time + "ms");
    return modified;
  }
  return response;
};
unsafeWindow.Manager = Manager;
