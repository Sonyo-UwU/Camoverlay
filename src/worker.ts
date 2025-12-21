/* Only import types here ; this will run in a web worker */

import type { PixelCoordsObject } from './Coords';
import type { MessageComputeBase64Data, MessageCreateTemplate, MessageDrawOnTile, MessageTemplateFromStorage, WorkerMessage } from './Messages';
import type { PixelIndex, TileIndex, TileProgress, WorkerWplaceColor, WplaceColorId } from './types';

type WorkerTemplate = {
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    coords: PixelCoordsObject;
};

declare const self: Worker;
declare const LZString: {
    compressToBase64(input: string): string;
    decompressFromBase64(input: string): string;

    compressToUTF16(input: string): string;
    decompressFromUTF16(compressed: string): string;

    compressToUint8Array(uncompressed: string): Uint8Array;
    decompressFromUint8Array(compressed: Uint8Array): string;

    compressToEncodedURIComponent(input: string): string;
    decompressFromEncodedURIComponent(compressed: string): string;

    compress(input: string): string;
    decompress(compressed: string): string;
};

declare global {
    /**
     * Randomize array in-place using Durstenfeld shuffle algorithm and returns the reference to the array.
     */
    interface Array<T> {
        shuffle(): Array<T>;
    }
}

export function workerFunction() {
    //#region Utils

    let rgbColorMap: Map<WplaceColorId, WorkerWplaceColor>;
    const otherColor: WorkerWplaceColor = { id: rgbToId(136, 136, 136), rgb: [136, 136, 136] };

    function rgbToId(r: number, g: number, b: number): WplaceColorId {
        return r * 1000 * 1000 + g * 1000 + b as WplaceColorId;
    }

    function closeEnough(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): boolean {
        const dr = r1 - r2;
        const dg = g1 - g2;
        const db = b1 - b2;
        return dr * dr + dg * dg + db * db <= 100;
    } function getColor(r: number, g: number, b: number): WorkerWplaceColor {
        const id = rgbToId(r, g, b);
        const color = rgbColorMap.get(id);
        if (color !== undefined)
            return color;

        return otherColor;
    }

    function getClosestColor(r: number, g: number, b: number): WorkerWplaceColor {
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

    Array.prototype.shuffle = function<T>(this: Array<T>) {
        for (let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = this[i]!;
            this[i] = this[j]!;
            this[j] = temp;
        }

        return this;
    }

    //#endregion

    const templates = new Map<string, WorkerTemplate>();

    self.onmessage = e => {
        const m = e.data as WorkerMessage;
        switch (m.name) {
            case 'Init':
                rgbColorMap = new Map<WplaceColorId, WorkerWplaceColor>(m.data.rgbColorMap);
                break;
            case 'CreateTemplate':
                templateFromBitmap(m.data);
                break;
            case 'TemplateFromStorage':
                templateFromBase64Data(m.data);
                break;
            case 'ComputeBase64Data':
                computeBase64Data(m.data.name);
                break;
            case 'DrawOnTile':
                drawOnTile(m.data);
                break;
            default:
                const n: never = m;
                n;
                break;
        }
    };
    
    function templateFromBitmap({ name, bitmap, coords }: MessageCreateTemplate['message']['data']): void {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const tiles = new Map<TileIndex, Map<WplaceColorId, number>>();
        
        // Create pattern and count pixels
        for (let y = 0; y < imageData.height; y++)
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;

                // Ignore transparent pixels
                if (imageData.data[pixelIndex + 3]! < 128)
                    continue;

                const tileIndex = (coords.tx + Math.floor(coords.px / 1000)) % 2048 * 10000 + (coords.ty + Math.floor(coords.py / 1000)) % 2048 as TileIndex;
                let tile = tiles.get(tileIndex);
                if (tile === undefined) {
                    tile = new Map();
                    tiles.set(tileIndex, tile);
                }

                const color = getClosestColor(imageData.data[pixelIndex + 0]!, imageData.data[pixelIndex + 1]!, imageData.data[pixelIndex + 2]!);

                tile.set(color.id, tile.get(color.id) ?? 0 + 1);

                if (color !== otherColor) {
                    imageData.data[pixelIndex + 0] = color.rgb[0];
                    imageData.data[pixelIndex + 1] = color.rgb[1];
                    imageData.data[pixelIndex + 2] = color.rgb[2];
                }
            }


        templates.set(name, { imageData: imageData.data, width: canvas.width, height: canvas.height, coords: coords });
        setTimeout(() => computeBase64Data(name));

        // Send response
        const response: MessageCreateTemplate['response'] = {
            name: 'CreateTemplate',
            data: {
                name: name,
                tiles: tiles.entries().toArray().map(([index, colors]) => [index, colors.entries().toArray()])
            }
        };
        self.postMessage(response);
    }

    function templateFromBase64Data({ name, width, height, coords, base64Data }: MessageTemplateFromStorage['message']['data']): void {
        try {
            const binary = atob(LZString.decompress(base64Data)); // ASCII to Binary
            const array = new Uint8ClampedArray(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }
            templates.set(name, { imageData: array, width: width, height: height, coords: coords });
        }
        catch {
            const message: MessageTemplateFromStorage['response'] = {
                name: 'TemplateFromStorage',
                data: {
                    name: name
                }
            };
            self.postMessage(message);
        }
    }

    function computeBase64Data(name: string): void {
        const imageData = templates.get(name)?.imageData;
        if (imageData === undefined)
            return;

        let binary = '';
        for (let i = 0; i < imageData.length; i++) {
            binary += String.fromCharCode(imageData[i]!);
        }
        const base64Data = LZString.compress(btoa(binary)); // Binary to ASCII

        // Send response
        const response: MessageComputeBase64Data['response'] = {
            name: 'ComputeBase64Data',
            data: {
                name: name,
                base64Data: base64Data
            }
        };
        self.postMessage(response);
    }

    function drawOnTile({ name, tile, key, patternSize, trackProgress, enabled, modifyPixels, canvasWidth, canvas }: MessageDrawOnTile['message']['data']): void {
        const template = templates.get(name);
        if (template === undefined)
            return;

        const enabledMap = new Map(enabled);

        let needToStoreTemplates = false;

        //const ctx = canvas.getContext('2d')!;
        //const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const canvasImageData = new Uint8ClampedArray(canvas);

        const isFirstX = template.coords.tx === tile.x;
        const isFirstY = template.coords.ty === tile.y;
        const colorsProgress = new Map<WplaceColorId, TileProgress>();
        const teleportPixels = new Map<WplaceColorId, { unpainted: PixelIndex[], wrong: PixelIndex[]; }>();

        for (let iy = isFirstY ? 0 : (tile.y - template.coords.ty) * 1000 - template.coords.py,
            cy = isFirstY ? template.coords.py : 0;
            iy < template.height && cy < 1000;
            iy++, cy++)
            for (let ix = isFirstX ? 0 : (tile.x - template.coords.tx) * 1000 - template.coords.px,
                cx = isFirstX ? template.coords.px : 0;
                ix < template.width && cx < 1000;
                ix++, cx++) {
                const imagePixelIndex = (iy * template.width + ix) * 4;
                const canvasPixelIndex = ((cy * patternSize + 1) * canvasWidth + cx * patternSize + 1) * 4;

                if (template.imageData[imagePixelIndex + 3]! === 0)
                    continue;

                let color = getColor(template.imageData[imagePixelIndex + 0]!, template.imageData[imagePixelIndex + 1]!, template.imageData[imagePixelIndex + 2]!);
                const paintedColor = getClosestColor(canvasImageData[canvasPixelIndex + 0]!, canvasImageData[canvasPixelIndex + 1]!, canvasImageData[canvasPixelIndex + 2]!);


                const pixelTileIndex = (tile.x * 10000 + tile.y) * 1000000 + (cx * 1000 + cy) as PixelIndex;
                let teleport = teleportPixels.get(color.id);
                if (teleport === undefined) {
                    teleport = { unpainted: [], wrong: [] };
                    teleportPixels.set(color.id, teleport);
                }

                if (modifyPixels.includes(pixelTileIndex)) {
                    if (color !== paintedColor) {
                        needToStoreTemplates = true;

                        color = paintedColor;
                        template.imageData[imagePixelIndex + 0] = canvasImageData[canvasPixelIndex + 0]!;
                        template.imageData[imagePixelIndex + 1] = canvasImageData[canvasPixelIndex + 1]!;
                        template.imageData[imagePixelIndex + 2] = canvasImageData[canvasPixelIndex + 2]!;
                        template.imageData[imagePixelIndex + 3] = canvasImageData[canvasPixelIndex + 3]!;


                        if (template.imageData[imagePixelIndex + 3]! === 0)
                            continue;
                    }
                }



                if (trackProgress) {
                    let progress = colorsProgress.get(color.id);
                    if (progress === undefined) {
                        progress = {
                            total: 0,
                            unpainted: 0,
                            wrong: 0
                        };
                        colorsProgress.set(color.id, progress);
                    }

                    progress.total++;
                    if (canvasImageData[canvasPixelIndex + 3] === 0) {
                        // Unpainted
                        progress.unpainted++;
                        teleport.unpainted.push(pixelTileIndex);
                    }
                    else if (color !== paintedColor) {
                        // Wrong
                        progress.wrong++;
                        teleport.wrong.push(pixelTileIndex);
                    }
                }

                if (enabledMap.get(color.id)) {
                    canvasImageData[canvasPixelIndex + 0] = template.imageData[imagePixelIndex + 0]!;
                    canvasImageData[canvasPixelIndex + 1] = template.imageData[imagePixelIndex + 1]!;
                    canvasImageData[canvasPixelIndex + 2] = template.imageData[imagePixelIndex + 2]!;
                    canvasImageData[canvasPixelIndex + 3] = template.imageData[imagePixelIndex + 3]!;
                }
            }

        if (needToStoreTemplates)
            setTimeout(() => computeBase64Data(name));

        teleportPixels.forEach(t => {
            t.unpainted.shuffle().splice(100);
            t.wrong.shuffle().splice(100);
        });

        const message: MessageDrawOnTile['response'] = {
            name: 'DrawOnTile',
            data: {
                key: key,
                colorsProgress: colorsProgress.entries().toArray(),
                teleportPixels: teleportPixels.entries().toArray().filter(([_, teleport]) => teleport.unpainted.length + teleport.wrong.length > 0),
                canvas: canvasImageData.buffer
            }
        };
        self.postMessage(message, [canvasImageData.buffer]);
    }
}
