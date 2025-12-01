import { PixelCoords, TileCoords } from './Coords';
import { Manager } from './Manager';
import { JsonifiedValue, TileIndex, WplaceColorId } from './types';
import { getClosestColor, getColor, otherColor } from './utils';

type StoredTemplate = Omit<JsonifiedValue<Omit<Template, 'toJSON'>>, 'overlappedTiles' | 'imageData' | 'colorsInfo'> & {
    colorsInfo: [WplaceColorId, number][]
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
    overlappedTiles: TileIndex[];
    imageData: Uint8ClampedArray | null;
    width: number;
    height: number;
    base64Data: string;
    colorsInfo: Map<WplaceColorId, number>;
    totalPixelCount: number;
    enabled: boolean;


    constructor(name: string, coords: PixelCoords, width: number, height: number) {
        this.name = name;
        this.coords = coords;
        this.overlappedTiles = [];
        this.imageData = null;
        this.width = width;
        this.height = height;
        this.base64Data = '';
        this.colorsInfo = new Map();
        this.totalPixelCount = 0;
        this.enabled = true;
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
        template.imageData = imageData.data;

        // Compute base64 data
        let binary = '';
        for (let i = 0; i < template.imageData.length; i++) {
            binary += String.fromCharCode(template.imageData[i]!);
        }
        template.base64Data = LZString.compress(btoa(binary)); // Binary to ASCII


        template.#computeOverlappedTiles();

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
        template.totalPixelCount = stored.totalPixelCount;
        template.colorsInfo = new Map(stored.colorsInfo);
        template.#computeOverlappedTiles();

        return template;
    }

    overlaps(tile: TileIndex): boolean {
        return this.overlappedTiles.includes(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D): void {
        if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
            return;

        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

        const startX = (this.coords.tx - tile.x) * 1000;
        const endX = Math.min(startX + this.width, 1000);
        const startY = (this.coords.ty - tile.y) * 1000;
        const endY = Math.min(startY + this.height, 1000);

        for (let y = startY; y < endY; y++)
            for (let x = startX; x < endX; x++) {
                const imagePixelIndex = (y * this.width + x) * 4;
                const canvasPixelIndex = (((y + this.coords.py) * Manager.patternSize + 1) * ctx.canvas.width + (x + this.coords.px) * Manager.patternSize + 1) * 4;

                if (this.imageData[imagePixelIndex + 3]! === 0)
                    continue;

                const color = getColor(this.imageData[imagePixelIndex + 0]!, this.imageData[imagePixelIndex + 1]!, this.imageData[imagePixelIndex + 2]!);

                if (Manager.enabledColors.get(color.id)) {
                    imageData.data[canvasPixelIndex + 0] = this.imageData[imagePixelIndex + 0]!;
                    imageData.data[canvasPixelIndex + 1] = this.imageData[imagePixelIndex + 1]!;
                    imageData.data[canvasPixelIndex + 2] = this.imageData[imagePixelIndex + 2]!;
                    imageData.data[canvasPixelIndex + 3] = this.imageData[imagePixelIndex + 3]!;
                }
            }

        ctx.putImageData(imageData, 0, 0);
    }

    toJSON(_: string | number): StoredTemplate {
        return {
            name: this.name,
            coords: this.coords,
            width: this.width,
            height: this.height,
            totalPixelCount: this.totalPixelCount,
            colorsInfo: this.colorsInfo.entries().toArray(),
            base64Data: this.base64Data,
            enabled: this.enabled
        };
    }

    #computeOverlappedTiles(): void {
        this.overlappedTiles = [];

        const end = new PixelCoords(this.coords.tx, this.coords.ty, this.coords.px + this.width, this.coords.py + this.height);

        for (let i = this.coords.tx; i <= end.tx; i++)
            for (let j = this.coords.ty; j <= end.ty; j++)
                this.overlappedTiles.push(TileCoords.toIndex(i, j));
    }
}
