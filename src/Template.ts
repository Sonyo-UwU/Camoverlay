import { PixelCoords, TileCoords } from './Coords';
import { Manager } from './Manager';
import { NonFunctionKeys, TileIndex } from './types';

export default class Template {
    name: string;
    coords: PixelCoords;
    overlappedTiles: TileIndex[];
    bitmap: ImageBitmap | null;
    base64Data: string;


    constructor(name: string, coords: PixelCoords) {
        this.name = name;
        this.coords = coords;
        this.overlappedTiles = [];
        this.bitmap = null;
        this.base64Data = '';
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

        for (let y = 0; y < imageData.height; y++)
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;
                if (x % Manager.patternSize !== 1 || y % Manager.patternSize !== 1)
                    imageData.data[pixelIndex + 3] = 0;
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

    static async fromBase64(name: string, coords: PixelCoords, base64Data: string): Promise<Template> {
        const template = new Template(name, coords);

        const binary = atob(base64Data); // ASCII to Binary
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: "image/png" });
        template.bitmap = await createImageBitmap(blob);
        template.base64Data = base64Data;
        template.#computeOverlappedTiles();

        return template;
    }

    overlaps(tile: TileIndex): boolean {
        return this.overlappedTiles.includes(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D): void {
        if (this.bitmap === null || !this.overlaps(tile.toIndex()))
            return;

        ctx.drawImage(this.bitmap,
            (this.coords.tx * 1000 + this.coords.px - tile.x * 1000) * Manager.patternSize,
            (this.coords.ty * 1000 + this.coords.py - tile.y * 1000) * Manager.patternSize);
    }

    toJSON(_: string | number): Omit<NonFunctionKeys<Template>, "overlappedTiles" | "bitmap"> {
        return {
            name: this.name,
            coords: this.coords,
            base64Data: this.base64Data
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
