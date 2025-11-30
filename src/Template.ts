import { PixelCoords, TileCoords } from './Coords';
import { Manager } from './Manager';
import { JsonifiedValue, TileIndex, WplaceColorId } from './types';
import { getClosestColor, getColor, otherColor } from './utils';

type StoredTemplate = Omit<JsonifiedValue<Omit<Template, 'toJSON'>>, 'overlappedTiles' | 'bitmap' | 'colorsInfo'> & {
    colorsInfo: [WplaceColorId, number][]
};

export default class Template {
    name: string;
    coords: PixelCoords;
    overlappedTiles: TileIndex[];
    bitmap: ImageBitmap | null;
    base64Data: string;
    colorsInfo: Map<WplaceColorId, number>;
    totalPixelCount: number;
    enabled: boolean;


    constructor(name: string, coords: PixelCoords) {
        this.name = name;
        this.coords = coords;
        this.overlappedTiles = [];
        this.bitmap = null;
        this.base64Data = '';
        this.colorsInfo = new Map();
        this.totalPixelCount = 0;
        this.enabled = true;
    }

    static async fromFile(name: string, coords: PixelCoords, file: File): Promise<Template> {
        const template = new Template(name, coords);

        const bitmap = await createImageBitmap(file);

        // Compute bitmap
        const canvas = new OffscreenCanvas(Manager.patternSize * bitmap.width, Manager.patternSize * bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Create pattern and count pixels
        for (let y = 0; y < imageData.height; y++)
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;
                if (x % Manager.patternSize !== 1 || y % Manager.patternSize !== 1) {
                    imageData.data[pixelIndex + 3] = 0;
                    continue;
                }

                // Ignore transparent pixels
                if (imageData.data[pixelIndex + 3]! < 128)
                    continue;

                const color = getClosestColor(imageData.data[pixelIndex + 0]!, imageData.data[pixelIndex + 1]!, imageData.data[pixelIndex + 2]!);
                template.colorsInfo.set(color.id, (template.colorsInfo.get(color.id) ?? 0) + 1);
                template.totalPixelCount++;

                if (color !== otherColor) {
                    imageData.data[pixelIndex + 0] = color.rgb[0];
                    imageData.data[pixelIndex + 1] = color.rgb[1];
                    imageData.data[pixelIndex + 2] = color.rgb[2];
                }
            }
        
        ctx.putImageData(imageData, 0, 0);

        // Compute base64 data
        const canvasBuffer = await (await canvas.convertToBlob()).bytes();
        let binary = '';
        for (let i = 0; i < canvasBuffer.length; i++) {
            binary += String.fromCharCode(canvasBuffer[i]!);
        }
        template.base64Data = btoa(binary); // Binary to ASCII


        template.bitmap = canvas.transferToImageBitmap();
        template.#computeOverlappedTiles();

        return template;
    }

    static async fromStorage(stored: StoredTemplate): Promise<Template> {
        const template = new Template(stored.name, PixelCoords.copy(stored.coords));

        const binary = atob(stored.base64Data); // ASCII to Binary
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: "image/png" });
        template.bitmap = await createImageBitmap(blob);
        template.base64Data = stored.base64Data;
        template.totalPixelCount = stored.totalPixelCount;
        template.colorsInfo = new Map(stored.colorsInfo);
        template.#computeOverlappedTiles();

        return template;
    }

    overlaps(tile: TileIndex): boolean {
        return this.overlappedTiles.includes(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D, noColorFilter: boolean): void {
        if (!this.enabled || this.bitmap === null || !this.overlaps(tile.toIndex()))
            return;

        ctx.drawImage(this.bitmap,
            (this.coords.tx * 1000 + this.coords.px - tile.x * 1000) * Manager.patternSize,
            (this.coords.ty * 1000 + this.coords.py - tile.y * 1000) * Manager.patternSize);

        if (noColorFilter)
            return;


        // Apply color filter
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

        for (let y = 1; y < 1000 * Manager.patternSize; y += Manager.patternSize)
            for (let x = 1; x < 1000 * Manager.patternSize; x += Manager.patternSize) {
                const pixelIndex = (y * ctx.canvas.width + x) * 4;
                const color = getColor(imageData.data[pixelIndex + 0]!, imageData.data[pixelIndex + 1]!, imageData.data[pixelIndex + 2]!);

                if (!Manager.enabledColors.get(color.id))
                    imageData.data[pixelIndex + 3] = 0;
            }

        ctx.putImageData(imageData, 0, 0);
    }

    toJSON(_: string | number): StoredTemplate {
        return {
            name: this.name,
            coords: this.coords,
            totalPixelCount: this.totalPixelCount,
            colorsInfo: this.colorsInfo.entries().toArray(),
            base64Data: this.base64Data,
            enabled: this.enabled
        };
    }

    #computeOverlappedTiles(): void {
        if (this.bitmap == null)
            return;

        this.overlappedTiles = [];

        const end = new PixelCoords(this.coords.tx, this.coords.ty, this.coords.px + this.bitmap.width, this.coords.py + this.bitmap.height);

        for (let i = this.coords.tx; i <= end.tx; i++)
            for (let j = this.coords.ty; j <= end.ty; j++)
                this.overlappedTiles.push(TileCoords.toIndex(i, j));
    }
}
