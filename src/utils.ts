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


function closeEnough(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): boolean {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db <= 100;
}

function rgbToId(r: number, g: number, b: number): WplaceColorId {
    return r * 1000 * 1000 + g * 1000 + b;
}

export const otherColor: WplaceColor = { id: rgbToId(136, 136, 136), name: 'Other', rgb: [136, 136, 136] };

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

const colorPalette: Omit<WplaceColor, 'id'>[] = [
    { name: "Transparent"     , rgb: [222, 250, 206] },
    { name: "Black"           , rgb: [  0,   0,   0] },
    { name: "Dark Gray"       , rgb: [ 60,  60,  60] },
    { name: "Gray"            , rgb: [120, 120, 120] },
    { name: "Light Gray"      , rgb: [210, 210, 210] },
    { name: "White"           , rgb: [255, 255, 255] },
    { name: "Deep Red"        , rgb: [ 96,   0,  24] },
    { name: "Red"             , rgb: [237,  28,  36] },
    { name: "Orange"          , rgb: [255, 127,  39] },
    { name: "Gold"            , rgb: [246, 170,   9] },
    { name: "Yellow"          , rgb: [249, 221,  59] },
    { name: "Light Yellow"    , rgb: [255, 250, 188] },
    { name: "Dark Green"      , rgb: [ 14, 185, 104] },
    { name: "Green"           , rgb: [ 19, 230, 123] },
    { name: "Light Green"     , rgb: [135, 255,  94] },
    { name: "Dark Teal"       , rgb: [ 12, 129, 110] },
    { name: "Teal"            , rgb: [ 16, 174, 166] },
    { name: "Light Teal"      , rgb: [ 19, 225, 190] },
    { name: "Dark Blue"       , rgb: [ 40,  80, 158] },
    { name: "Blue"            , rgb: [ 64, 147, 228] },
    { name: "Cyan"            , rgb: [ 96, 247, 242] },
    { name: "Indigo"          , rgb: [107,  80, 246] },
    { name: "Light Indigo"    , rgb: [153, 177, 251] },
    { name: "Dark Purple"     , rgb: [120,  12, 153] },
    { name: "Purple"          , rgb: [170,  56, 185] },
    { name: "Light Purple"    , rgb: [224, 159, 249] },
    { name: "Dark Pink"       , rgb: [203,   0, 122] },
    { name: "Pink"            , rgb: [236,  31, 128] },
    { name: "Light Pink"      , rgb: [243, 141, 169] },
    { name: "Dark Brown"      , rgb: [104,  70,  52] },
    { name: "Brown"           , rgb: [149, 104,  42] },
    { name: "Beige"           , rgb: [248, 178, 119] },
    { name: "Medium Gray"     , rgb: [170, 170, 170] },
    { name: "Dark Red"        , rgb: [165,  14,  30] },
    { name: "Light Red"       , rgb: [250, 128, 114] },
    { name: "Dark Orange"     , rgb: [228,  92,  26] },
    { name: "Light Tan"       , rgb: [214, 181, 148] },
    { name: "Dark Goldenrod"  , rgb: [156, 132,  49] },
    { name: "Goldenrod"       , rgb: [197, 173,  49] },
    { name: "Light Goldenrod" , rgb: [232, 212,  95] },
    { name: "Dark Olive"      , rgb: [ 74, 107,  58] },
    { name: "Olive"           , rgb: [ 90, 148,  74] },
    { name: "Light Olive"     , rgb: [132, 197, 115] },
    { name: "Dark Cyan"       , rgb: [ 15, 121, 159] },
    { name: "Light Cyan"      , rgb: [187, 250, 242] },
    { name: "Light Blue"      , rgb: [125, 199, 255] },
    { name: "Dark Indigo"     , rgb: [ 77,  49, 184] },
    { name: "Dark Slate Blue" , rgb: [ 74,  66, 132] },
    { name: "Slate Blue"      , rgb: [122, 113, 196] },
    { name: "Light Slate Blue", rgb: [181, 174, 241] },
    { name: "Light Brown"     , rgb: [219, 164,  99] },
    { name: "Dark Beige"      , rgb: [209, 128,  81] },
    { name: "Light Beige"     , rgb: [255, 197, 165] },
    { name: "Dark Peach"      , rgb: [155,  82,  73] },
    { name: "Peach"           , rgb: [209, 128, 120] },
    { name: "Light Peach"     , rgb: [250, 182, 164] },
    { name: "Dark Tan"        , rgb: [123,  99,  82] },
    { name: "Tan"             , rgb: [156, 132, 107] },
    { name: "Dark Slate"      , rgb: [ 51,  57,  65] },
    { name: "Slate"           , rgb: [109, 117, 141] },
    { name: "Light Slate"     , rgb: [179, 185, 209] },
    { name: "Dark Stone"      , rgb: [109, 100,  63] },
    { name: "Stone"           , rgb: [148, 140, 107] },
    { name: "Light Stone"     , rgb: [205, 197, 158] }
];

const rgbColorMap = new Map<WplaceColorId, WplaceColor>();
for (const color of colorPalette) {
    rgbColorMap.set(rgbToId(...color.rgb), { ...color, id: rgbToId(...color.rgb) });
}
