/* Only import types here ; this will run in a web worker */

import type { MessageCreateTemplate, WorkerMessage, WorkerResponse } from './Messages';
import type { TileIndex, WorkerWplaceColor, WplaceColorId } from './types';

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

    //#endregion


    self.onmessage = e => {
        const m = e.data as WorkerMessage;
        let result: WorkerResponse['data'] | null = null;
        let transferable: Transferable[] = [];
        switch (m.name) {
            case 'Init':
                rgbColorMap = new Map<WplaceColorId, WorkerWplaceColor>(m.data.rgbColorMap);
                break;
            case 'CreateTemplate':
                [result, transferable] = templateFromBitmap(m.data);
                break;
            default:
                const n: never = m;
                n;
                break;
        }

        if (result === null)
            return;

        const response: WorkerResponse = {
            name: 'CreateTemplate',
            data: result
        };
        self.postMessage(response, transferable);
    };
    
    function templateFromBitmap({ name, bitmap, coords }: MessageCreateTemplate['message']['data']): [MessageCreateTemplate['response']['data'], Transferable[]] {
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

        // Compute base64 data
        let binary = '';
        for (let i = 0; i < imageData.data.length; i++) {
            binary += String.fromCharCode(imageData.data[i]!);
        }
        const base64Data = LZString.compress(btoa(binary)); // Binary to ASCII

        const buffer = imageData.data.buffer;
        return [{
            name: name,
            tiles: tiles.entries().toArray().map(([index, colors]) => [index, colors.entries().toArray()]),
            imageData: buffer,
            base64Data: base64Data
        }, [buffer]];
    }
}
