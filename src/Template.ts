import { PixelCoords, TileCoords } from './Coords';
import { updateTemplatePixelCount } from './display';
import { Manager } from './Manager';
import { JsonifiedValue, TileIndex, TileProgress, WplaceColorId } from './types';
import { getClosestColor, getColor, otherColor } from './utils';

type StoredTemplate = Omit<JsonifiedValue<Omit<Template, 'toJSON'>>, 'imageData' | 'tiles' | 'totalProgress'> & {
    tiles: [TileIndex, [WplaceColorId, number][]][];
};

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
    }

    static async fromFile(name: string, coords: PixelCoords, file: File): Promise<Template> {
        const bitmap = await createImageBitmap(file);

        const template = new Template(name, coords, bitmap.width, bitmap.height);

        // Compute bitmap
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Create pattern and count pixels
        for (let y = 0; y < imageData.height; y++)
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;

                // Ignore transparent pixels
                if (imageData.data[pixelIndex + 3]! < 128)
                    continue;

                const tileIndex = new PixelCoords(coords.tx, coords.ty, coords.px + x, coords.py + y).toTileIndex();
                let tile = template.tiles.get(tileIndex);
                if (tile === undefined) {
                    tile = new Map();
                    template.tiles.set(tileIndex, tile);
                }

                const color = getClosestColor(imageData.data[pixelIndex + 0]!, imageData.data[pixelIndex + 1]!, imageData.data[pixelIndex + 2]!);

                let progress = tile.get(color.id);
                if (progress === undefined) {
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

        // Compute base64 data
        let binary = '';
        for (let i = 0; i < template.imageData.length; i++) {
            binary += String.fromCharCode(template.imageData[i]!);
        }
        template.base64Data = LZString.compress(btoa(binary)); // Binary to ASCII

        return template;
    }

    static async fromStorage(stored: StoredTemplate): Promise<Template> {
        const template = new Template(stored.name, PixelCoords.copy(stored.coords), stored.width, stored.height);

        const binary = atob(LZString.decompress(stored.base64Data)); // ASCII to Binary
        const array = new Uint8ClampedArray(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        template.imageData = array;
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

    overlaps(tile: TileIndex): boolean {
        return this.tiles.has(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D, trackProgress: boolean): void {
        if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
            return;

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

                const color = getColor(this.imageData[imagePixelIndex + 0]!, this.imageData[imagePixelIndex + 1]!, this.imageData[imagePixelIndex + 2]!);
                const paintedColor = getClosestColor(canvasImageData[canvasPixelIndex + 0]!, canvasImageData[canvasPixelIndex + 1]!, canvasImageData[canvasPixelIndex + 2]!);

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
                    }
                    else {
                        if (color !== paintedColor) {
                            // Wrong
                            progress.wrong++;
                        }
                    }
                }

                if (Manager.enabledColors.get(color.id)) {
                    if (canvasImageData[canvasPixelIndex + 3] !== 0 && color !== paintedColor) {
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
