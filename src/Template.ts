import { PixelCoords, TileCoords } from './Coords';
import { Manager } from './Manager';
import { TileIndex } from './types';

export default class Template {
    name: string;
    coords: PixelCoords;
    overlapedTiles: TileIndex[];
    bitmap: ImageBitmap | null;


    constructor(name: string, coords: PixelCoords) {
        this.name = name;
        this.coords = coords;
        this.overlapedTiles = [];
        this.bitmap = null;
    }

    static async fromFile(name: string, coords: PixelCoords, file: File): Promise<Template> {
        const template = new Template(name, coords);

        const bitmap = await createImageBitmap(file);


        // Compute overlapped tiles
        const end = new PixelCoords(coords.tile, coords.x + bitmap.width, coords.y + bitmap.height);

        for (let i = template.coords.tile.x; i <= end.tile.x; i++)
            for (let j = template.coords.tile.y; j <= end.tile.y; j++)
                template.overlapedTiles.push(TileCoords.toIndex(i, j));


        // Compute bitmap
        const canvas = new OffscreenCanvas(Manager.patternSize * bitmap.width, Manager.patternSize * bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < imageData.height; y++)
            for (let x = 0; x < imageData.width; x++) {
                const pixelIndex = (y * imageData.width + x) * 4;
                if (x % Manager.patternSize !== 1 || y % Manager.patternSize !== 1)
                    imageData.data[pixelIndex + 3] = 0;
            }
        
        ctx.putImageData(imageData, 0, 0);


        template.bitmap = canvas.transferToImageBitmap();


        return template;
    }

    overlaps(tile: TileIndex): boolean {
        return this.overlapedTiles.includes(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D): void {
        if (this.bitmap === null || !this.overlaps(tile.toIndex()))
            return;

        ctx.drawImage(this.bitmap,
            (this.coords.tile.x * 1000 + this.coords.x - tile.x * 1000) * Manager.patternSize,
            (this.coords.tile.y * 1000 + this.coords.y - tile.y * 1000) * Manager.patternSize);
    }
}
