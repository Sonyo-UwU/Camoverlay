import { PixelCoords, TileCoords } from './Coords';
import { WplaceColor, WplaceColorId } from './types';

export function parsePixelCoordsFromURL(url: string): PixelCoords {
    const urlSplitted = url.split('/');
    const last = urlSplitted[urlSplitted.length - 1]!;

    return new PixelCoords(
        parseInt(urlSplitted[urlSplitted.length - 2]!),
        parseInt(urlSplitted[urlSplitted.length - 1]!),
        parseInt(last.substring(last.indexOf('?') + 3)),
        parseInt(last.substring(last.indexOf('&') + 3))
    );
}

export function parseTileCoordsFromURL(url: string): TileCoords {
    const urlSplitted = url.split('/');
    return new TileCoords(
        parseInt(urlSplitted[urlSplitted.length - 2] ?? ''),
        parseInt(urlSplitted[urlSplitted.length - 1] ?? '')
    );
}

export function getZoomLevelForPixelSize(x: number): number {
    return Math.log2(x / 100) + 18.6;
}

export function pickRandomArray<T>(a: T[]): T | null {
    if (a.length === 0)
        return null;

    return a[Math.floor(Math.random() * a.length)]!;
}

export function pickRandomSet<T>(s: Set<T>): T | null {
    const index = Math.floor(Math.random() * s.size);
    let cntr = 0;
    for (const key of s.values())
        if (cntr++ === index)
            return key;
    return null;
}

export const enum ColorSortingOptions {
    Total = 'Total',
    Remaining = 'Remaining',
    Wrong = 'Wrong',
    Original = 'Original',
    Luminance = 'Luminance',
    Hue = 'Hue'
};


function twoHexDigits(n: number): string {
    return n < 16 ? '0' + n.toString(16) : n.toString(16);
}


function closeEnough(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): boolean {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db <= 100;
}

function rgbToId(r: number, g: number, b: number): WplaceColorId {
    return (r * 1000 * 1000 + g * 1000 + b) as WplaceColorId;
}

export function rgbToCss(rgb: [number, number, number]): string {
    return twoHexDigits(rgb[0]) + twoHexDigits(rgb[1]) + twoHexDigits(rgb[2]);
}

export const otherColor: WplaceColor = { internalId: -1, id: rgbToId(136, 136, 136), name: 'Other', rgb: [136, 136, 136], wplaceOrder: 64 };

export function getClosestColor(r: number, g: number, b: number): WplaceColor {
    const id = rgbToId(r, g, b);
    const color = rgbColorMap.get(id);
    if (color !== undefined)
        return color;

    for (const color of rgbColorMap.values()) {
        if (closeEnough(r, g, b, ...color.rgb))
            return color;
    }
    return otherColor;
}

export function getColor(r: number, g: number, b: number): WplaceColor {
    const id = rgbToId(r, g, b);
    const color = rgbColorMap.get(id);
    if (color !== undefined)
        return color;

    return otherColor;
}

export function computeLuminance(id: WplaceColorId): number {
    const color = rgbColorMap.get(id)!;
    if (color === otherColor)
        return 1;
    if (color.wplaceOrder === 63)
        return 0;

    return 0.299 * (color.rgb[0] / 255) + 0.587 * (color.rgb[1] / 255) + 0.114 * (color.rgb[2] / 255); // Range 0-1
}

export function computeHue(id: WplaceColorId): number {
    const color = rgbColorMap.get(id)!;
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
    return hue; // Range 0-360
}

const colorPalette: Omit<WplaceColor, 'id'>[] = [
    { internalId: 0 , name: "Transparent"     , rgb: [222, 250, 206], wplaceOrder: 63 },
    { internalId: 1 , name: "Black"           , rgb: [  0,   0,   0], wplaceOrder: 0 },
    { internalId: 2 , name: "Dark Gray"       , rgb: [ 60,  60,  60], wplaceOrder: 1 },
    { internalId: 3 , name: "Gray"            , rgb: [120, 120, 120], wplaceOrder: 2 },
    { internalId: 4 , name: "Light Gray"      , rgb: [210, 210, 210], wplaceOrder: 4 },
    { internalId: 5 , name: "White"           , rgb: [255, 255, 255], wplaceOrder: 5 },
    { internalId: 6 , name: "Deep Red"        , rgb: [ 96,   0,  24], wplaceOrder: 6 },
    { internalId: 7 , name: "Red"             , rgb: [237,  28,  36], wplaceOrder: 8 },
    { internalId: 8 , name: "Orange"          , rgb: [255, 127,  39], wplaceOrder: 11 },
    { internalId: 9 , name: "Gold"            , rgb: [246, 170,   9], wplaceOrder: 12 },
    { internalId: 10, name: "Yellow"          , rgb: [249, 221,  59], wplaceOrder: 13 },
    { internalId: 11, name: "Light Yellow"    , rgb: [255, 250, 188], wplaceOrder: 14 },
    { internalId: 12, name: "Dark Green"      , rgb: [ 14, 185, 104], wplaceOrder: 21 },
    { internalId: 13, name: "Green"           , rgb: [ 19, 230, 123], wplaceOrder: 22 },
    { internalId: 14, name: "Light Green"     , rgb: [135, 255,  94], wplaceOrder: 23 },
    { internalId: 15, name: "Dark Teal"       , rgb: [ 12, 129, 110], wplaceOrder: 24 },
    { internalId: 16, name: "Teal"            , rgb: [ 16, 174, 166], wplaceOrder: 25 },
    { internalId: 17, name: "Light Teal"      , rgb: [ 19, 225, 190], wplaceOrder: 26 },
    { internalId: 18, name: "Dark Blue"       , rgb: [ 40,  80, 158], wplaceOrder: 30 },
    { internalId: 19, name: "Blue"            , rgb: [ 64, 147, 228], wplaceOrder: 31 },
    { internalId: 20, name: "Cyan"            , rgb: [ 96, 247, 242], wplaceOrder: 28 },
    { internalId: 21, name: "Indigo"          , rgb: [107,  80, 246], wplaceOrder: 34 },
    { internalId: 22, name: "Light Indigo"    , rgb: [153, 177, 251], wplaceOrder: 35 },
    { internalId: 23, name: "Dark Purple"     , rgb: [120,  12, 153], wplaceOrder: 39 },
    { internalId: 24, name: "Purple"          , rgb: [170,  56, 185], wplaceOrder: 40 },
    { internalId: 25, name: "Light Purple"    , rgb: [224, 159, 249], wplaceOrder: 41 },
    { internalId: 26, name: "Dark Pink"       , rgb: [203,   0, 122], wplaceOrder: 42 },
    { internalId: 27, name: "Pink"            , rgb: [236,  31, 128], wplaceOrder: 43 },
    { internalId: 28, name: "Light Pink"      , rgb: [243, 141, 169], wplaceOrder: 44 },
    { internalId: 29, name: "Dark Brown"      , rgb: [104,  70,  52], wplaceOrder: 48 },
    { internalId: 30, name: "Brown"           , rgb: [149, 104,  42], wplaceOrder: 49 },
    { internalId: 31, name: "Beige"           , rgb: [248, 178, 119], wplaceOrder: 55 },
    { internalId: 32, name: "Medium Gray"     , rgb: [170, 170, 170], wplaceOrder: 3 },
    { internalId: 33, name: "Dark Red"        , rgb: [165,  14,  30], wplaceOrder: 7 },
    { internalId: 34, name: "Light Red"       , rgb: [250, 128, 114], wplaceOrder: 9 },
    { internalId: 35, name: "Dark Orange"     , rgb: [228,  92,  26], wplaceOrder: 10 },
    { internalId: 36, name: "Light Tan"       , rgb: [214, 181, 148], wplaceOrder: 53 },
    { internalId: 37, name: "Dark Goldenrod"  , rgb: [156, 132,  49], wplaceOrder: 15 },
    { internalId: 38, name: "Goldenrod"       , rgb: [197, 173,  49], wplaceOrder: 16 },
    { internalId: 39, name: "Light Goldenrod" , rgb: [232, 212,  95], wplaceOrder: 17 },
    { internalId: 40, name: "Dark Olive"      , rgb: [ 74, 107,  58], wplaceOrder: 18 },
    { internalId: 41, name: "Olive"           , rgb: [ 90, 148,  74], wplaceOrder: 19 },
    { internalId: 42, name: "Light Olive"     , rgb: [132, 197, 115], wplaceOrder: 20 },
    { internalId: 43, name: "Dark Cyan"       , rgb: [ 15, 121, 159], wplaceOrder: 27 },
    { internalId: 44, name: "Light Cyan"      , rgb: [187, 250, 242], wplaceOrder: 29 },
    { internalId: 45, name: "Light Blue"      , rgb: [125, 199, 255], wplaceOrder: 32 },
    { internalId: 46, name: "Dark Indigo"     , rgb: [ 77,  49, 184], wplaceOrder: 33 },
    { internalId: 47, name: "Dark Slate Blue" , rgb: [ 74,  66, 132], wplaceOrder: 36 },
    { internalId: 48, name: "Slate Blue"      , rgb: [122, 113, 196], wplaceOrder: 37 },
    { internalId: 49, name: "Light Slate Blue", rgb: [181, 174, 241], wplaceOrder: 38 },
    { internalId: 50, name: "Light Brown"     , rgb: [219, 164,  99], wplaceOrder: 50 },
    { internalId: 51, name: "Dark Beige"      , rgb: [209, 128,  81], wplaceOrder: 54 },
    { internalId: 52, name: "Light Beige"     , rgb: [255, 197, 165], wplaceOrder: 56 },
    { internalId: 53, name: "Dark Peach"      , rgb: [155,  82,  73], wplaceOrder: 45 },
    { internalId: 54, name: "Peach"           , rgb: [209, 128, 120], wplaceOrder: 46 },
    { internalId: 55, name: "Light Peach"     , rgb: [250, 182, 164], wplaceOrder: 47 },
    { internalId: 56, name: "Dark Tan"        , rgb: [123,  99,  82], wplaceOrder: 51 },
    { internalId: 57, name: "Tan"             , rgb: [156, 132, 107], wplaceOrder: 52 },
    { internalId: 58, name: "Dark Slate"      , rgb: [ 51,  57,  65], wplaceOrder: 60 },
    { internalId: 59, name: "Slate"           , rgb: [109, 117, 141], wplaceOrder: 61 },
    { internalId: 60, name: "Light Slate"     , rgb: [179, 185, 209], wplaceOrder: 62 },
    { internalId: 61, name: "Dark Stone"      , rgb: [109, 100,  63], wplaceOrder: 57 },
    { internalId: 62, name: "Stone"           , rgb: [148, 140, 107], wplaceOrder: 58 },
    { internalId: 63, name: "Light Stone"     , rgb: [205, 197, 158], wplaceOrder: 59 }
];

export const rgbColorMap = new Map<WplaceColorId, WplaceColor>();
for (const color of colorPalette) {
    rgbColorMap.set(rgbToId(...color.rgb), { ...color, id: rgbToId(...color.rgb) });
}
