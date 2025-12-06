import { PixelCoords, TileCoords } from './Coords';
import { Manager } from './Manager';
import { JsonifiedValue, TileIndex, TileProgress, WplaceColorId } from './types';
import { getClosestColor, getColor, otherColor } from './utils';

type StoredTemplate = Omit<JsonifiedValue<Omit<Template, 'toJSON'>>, 'imageData' | 'tiles' | 'totalPixelCount'> & {
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
    totalPixelCount: number;
    enabled: boolean;
    base64Data: string;


    constructor(name: string, coords: PixelCoords, width: number, height: number) {
        this.name = name;
        this.coords = coords;
        this.width = width;
        this.height = height;
        this.imageData = null;
        this.totalPixelCount = 0;
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
                template.totalPixelCount++;

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

        template.totalPixelCount = 0;
        template.tiles = new Map();
        for (const [index, colors] of stored.tiles) {
            const progress = new Map<WplaceColorId, TileProgress>();
            for (const [id, total] of colors) {
                progress.set(id, {
                    total: total,
                    unpainted: total,
                    wrong: 0
                });

                template.totalPixelCount += total;
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

        const startX = (this.coords.tx - tile.x) * 1000;
        const endX = Math.min(startX + this.width, 1000);
        const startY = (this.coords.ty - tile.y) * 1000;
        const endY = Math.min(startY + this.height, 1000);

        const colors = new Map<WplaceColorId, TileProgress>();
        
        for (let y = startY; y < endY; y++)
            for (let x = startX; x < endX; x++) {
                const imagePixelIndex = (y * this.width + x) * 4;
                const canvasPixelIndex = (((y + this.coords.py) * Manager.patternSize + 1) * ctx.canvas.width + (x + this.coords.px) * Manager.patternSize + 1) * 4;

                if (this.imageData[imagePixelIndex + 3]! === 0)
                    continue;

                const color = getColor(this.imageData[imagePixelIndex + 0]!, this.imageData[imagePixelIndex + 1]!, this.imageData[imagePixelIndex + 2]!);

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
                        const paintedColor = getColor(canvasImageData[canvasPixelIndex + 0]!, canvasImageData[canvasPixelIndex + 1]!, canvasImageData[canvasPixelIndex + 2]!);
                        if (color !== paintedColor) {
                            // Wrong
                            progress.wrong++;
                        }
                        else {
                            debugger;
                        }
                    }
                }

                if (Manager.enabledColors.get(color.id)) {
                    canvasImageData[canvasPixelIndex + 0] = this.imageData[imagePixelIndex + 0]!;
                    canvasImageData[canvasPixelIndex + 1] = this.imageData[imagePixelIndex + 1]!;
                    canvasImageData[canvasPixelIndex + 2] = this.imageData[imagePixelIndex + 2]!;
                    canvasImageData[canvasPixelIndex + 3] = this.imageData[imagePixelIndex + 3]!;
                }
            }

        this.tiles.set(tile.toIndex(), colors);
        ctx.putImageData(imageData, 0, 0);
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
