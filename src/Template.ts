import { PixelCoords, TileCoords } from './Coords';
import { TileIndex } from './types';

export default class Template {
    name: string;
    coords: PixelCoords;
    overlapedTiles: TileIndex[];
    bitmap: ImageBitmap;


    constructor(name: string, coords: PixelCoords, bitmap: ImageBitmap) {
        this.name = name;
        this.coords = coords;
        this.overlapedTiles = [];
        this.bitmap = bitmap;

        const end = new PixelCoords(coords.tile, coords.x + bitmap.width, coords.y + bitmap.height);

        for (let i = this.coords.tile.x; i <= end.tile.x; i++)
            for (let j = this.coords.tile.y; j <= end.tile.y; j++)
                this.overlapedTiles.push(TileCoords.toIndex(i, j));
    }

    overlaps(tile: TileIndex): boolean {
        return this.overlapedTiles.includes(tile);
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D): void {
        if (!this.overlaps(tile.toIndex()))
            return;

        ctx.drawImage(this.bitmap,
            this.coords.tile.x * 1000 + this.coords.x - tile.x * 1000,
            this.coords.tile.y * 1000 + this.coords.y - tile.y * 1000);
    }
}
