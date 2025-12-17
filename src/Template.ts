import { PixelCoords, TileCoords } from './Coords';
import { updateTemplatePixelCount } from './display';
import { Manager } from './Manager';
import { MessageCreateTemplate } from './Messages';
import { JsonifiedValue, PixelIndex, TileIndex, TileProgress, WplaceColorId } from './types';
import { getClosestColor, getColor } from './utils';

type StoredTemplate = JsonifiedValue<Omit<Template, 'toJSON' | 'imageData' | 'tiles' | 'totalProgress' | 'modifyPixels'> & {
    tiles: [TileIndex, [WplaceColorId, number][]][];
}>;

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

export default class Template {
    name: string;
    coords: PixelCoords;
    width: number;
    height: number;
    imageData: Uint8ClampedArray | null;
    tiles: Map<TileIndex, Map<WplaceColorId, TileProgress>>;
    totalProgress: TileProgress;
    enabled: boolean;
    base64Data: string;
    modifyPixels: PixelCoords[];


    constructor(name: string, coords: PixelCoords, width: number, height: number) {
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
        this.tiles = new Map();
        this.enabled = true;
        this.base64Data = '';
        this.modifyPixels = [];
    }

    static async fromFile(name: string, coords: PixelCoords, file: File): Promise<Template | null> {
        const bitmap = await createImageBitmap(file);
        const template = new Template(name, coords, bitmap.width, bitmap.height);

        const { promise, resolve, reject } = Promise.withResolvers<MessageCreateTemplate['response']['data']>();
        setTimeout(reject, 60 * 1000);

        Manager.workerCreateTemplateResolve.set(name, resolve);

        const message: MessageCreateTemplate['message'] = {
            name: 'CreateTemplate',
            data: {
                name: name,
                bitmap: bitmap,
                coords: { tx: coords.tx, ty: coords.ty, px: coords.px, py: coords.py }
            }
        };
        Manager.worker.postMessage(message, [bitmap]);

        const result = await promise.catch(() => null); // Wait for the worker

        Manager.workerCreateTemplateResolve.delete(name);
        
        if (result === null) {
            return null;
        }

        template.imageData = new Uint8ClampedArray(result.imageData);

        template.tiles = new Map();
        for (const [index, colors] of result.tiles) {
            const progress = new Map<WplaceColorId, TileProgress>();
            for (const [id, total] of colors) {
                progress.set(id, {
                    total: total,
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

    static async fromStorage(stored: StoredTemplate): Promise<Template | null> {
        if (stored.name === undefined ||
            stored.coords === undefined ||
            stored.width === undefined ||
            stored.height === undefined ||
            stored.base64Data === undefined ||
            stored.tiles === undefined)
            return null;

        const template = new Template(stored.name, PixelCoords.copy(stored.coords as any), stored.width, stored.height);
        if (stored.enabled !== undefined)
            template.enabled = stored.enabled;

        try {
            const binary = atob(LZString.decompress(stored.base64Data)); // ASCII to Binary
            const array = new Uint8ClampedArray(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }
            template.imageData = array;
        }
        catch {
            return null;
        }
        template.base64Data = stored.base64Data;

        template.tiles = new Map();
        for (const [index, colors] of stored.tiles) {
            const progress = new Map<WplaceColorId, TileProgress>();
            for (const [id, total] of colors) {
                progress.set(id, {
                    total: total,
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

    computeBase64Data() {
        let binary = '';
        for (let i = 0; i < this.imageData!.length; i++) {
            binary += String.fromCharCode(this.imageData![i]!);
        }
        this.base64Data = LZString.compress(btoa(binary)); // Binary to ASCII
    }

    overlaps(tile: TileIndex): boolean {
        return this.tiles.has(tile);
    }

    overlapsPixel(pixel: PixelCoords): boolean {
        const ix = (pixel.tx - this.coords.tx) * 1000 - this.coords.px + pixel.px;
        const iy = (pixel.ty - this.coords.ty) * 1000 - this.coords.py + pixel.py;
        return ix >= 0 && ix < this.width && iy >= 0 && iy < this.height;
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D, trackProgress: boolean): void {
        if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
            return;

        let needToStoreTemplates = false;

        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const canvasImageData = imageData.data;

        const isFirstX = this.coords.tx === tile.x;
        const isFirstY = this.coords.ty === tile.y;
        const colors = new Map<WplaceColorId, TileProgress>();

        for (let iy = isFirstY ? 0 : (tile.y - this.coords.ty) * 1000 - this.coords.py,
                 cy = isFirstY ? this.coords.py : 0;
                 iy < this.height && cy < 1000;
                 iy++, cy++)
            for (let ix = isFirstX ? 0 : (tile.x - this.coords.tx) * 1000 - this.coords.px,
                     cx = isFirstX ? this.coords.px : 0;
                     ix < this.width && cx < 1000;
                     ix++, cx++) {
                const imagePixelIndex = (iy * this.width + ix) * 4;
                const canvasPixelIndex = ((cy * Manager.patternSize + 1) * ctx.canvas.width + cx * Manager.patternSize + 1) * 4;

                if (this.imageData[imagePixelIndex + 3]! === 0)
                    continue;

                let color = getColor(this.imageData[imagePixelIndex + 0]!, this.imageData[imagePixelIndex + 1]!, this.imageData[imagePixelIndex + 2]!);
                const paintedColor = getClosestColor(canvasImageData[canvasPixelIndex + 0]!, canvasImageData[canvasPixelIndex + 1]!, canvasImageData[canvasPixelIndex + 2]!);


                const pixelTileIndex = PixelCoords.toIndex(tile.x, tile.y, cx, cy);

                const pixelModifyIndex = this.modifyPixels.findIndex(c => c.tx === tile.x && c.ty === tile.y && c.px === cx && c.py === cy);
                if (pixelModifyIndex !== -1) {
                    this.modifyPixels.splice(pixelModifyIndex, 1);

                    if (color !== paintedColor) {
                        needToStoreTemplates = true;

                        Manager.colorsInfo.get(color.id)?.unpainted.delete(pixelTileIndex);
                        Manager.colorsInfo.get(color.id)?.wrong.delete(pixelTileIndex);

                        color = paintedColor;
                        this.imageData[imagePixelIndex + 0] = canvasImageData[canvasPixelIndex + 0]!;
                        this.imageData[imagePixelIndex + 1] = canvasImageData[canvasPixelIndex + 1]!;
                        this.imageData[imagePixelIndex + 2] = canvasImageData[canvasPixelIndex + 2]!;
                        this.imageData[imagePixelIndex + 3] = canvasImageData[canvasPixelIndex + 3]!;



                        if (this.imageData[imagePixelIndex + 3]! === 0)
                            continue;
                    }
                }


                if (!Manager.colorsInfo.has(color.id)) {
                    Manager.colorsInfo.set(color.id, { enabled: true, unpainted: new Set<PixelIndex>(), wrong: new Set<PixelIndex>() });
                }

                const colorInfo = Manager.colorsInfo.get(color.id)!;

                if (trackProgress) {
                    let progress = colors.get(color.id);
                    if (progress === undefined) {
                        progress = {
                            total: 0,
                            unpainted: 0,
                            wrong: 0
                        };
                        colors.set(color.id, progress);
                    }

                    progress.total++;
                    if (canvasImageData[canvasPixelIndex + 3] === 0) {
                        // Unpainted
                        progress.unpainted++;

                        colorInfo.unpainted.add(pixelTileIndex);
                    }
                    else if (color !== paintedColor) {
                        // Wrong
                        progress.wrong++;

                        colorInfo.wrong.add(pixelTileIndex);
                    }
                    else {
                        // Correct
                        colorInfo.unpainted.delete(pixelTileIndex);
                        colorInfo.wrong.delete(pixelTileIndex);
                    }
                }

                if (colorInfo.enabled) {
                    if (Manager.settings.wrongHighlight && canvasImageData[canvasPixelIndex + 3] !== 0 && color !== paintedColor) {
                        // Wrong pixel highlight
                        for (const [dx, dy] of [[0, 1], [1, 0], [2, 1], [1, 2]]) {
                            const idx = ((cy * Manager.patternSize + dy!) * ctx.canvas.width + cx * Manager.patternSize + dx!) * 4;
                            canvasImageData[idx + 0] = 255;
                            canvasImageData[idx + 1] = 0;
                            canvasImageData[idx + 2] = 0;
                            canvasImageData[idx + 3] = 255;
                        }
                    }

                    canvasImageData[canvasPixelIndex + 0] = this.imageData[imagePixelIndex + 0]!;
                    canvasImageData[canvasPixelIndex + 1] = this.imageData[imagePixelIndex + 1]!;
                    canvasImageData[canvasPixelIndex + 2] = this.imageData[imagePixelIndex + 2]!;
                    canvasImageData[canvasPixelIndex + 3] = this.imageData[imagePixelIndex + 3]!;
                }
            }

        if (trackProgress) {
            this.tiles.set(tile.toIndex(), colors);
            this.updateTotalProgress();
            updateTemplatePixelCount(this);
        }

        if (needToStoreTemplates) {
            this.computeBase64Data();
            Manager.storeTemplates();
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

    toJSON(_: string | number): StoredTemplate {
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
}
