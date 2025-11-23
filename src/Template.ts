import { PixelCoords, TileCoords } from './Coords';
import { TileIndex } from './types';

export default class Template {
    name: string;
    coords: PixelCoords;
    affectedTiles: TileIndex[];
    bitmap: ImageBitmap;


    constructor(name: string, coords: PixelCoords, bitmap: ImageBitmap) {
        this.name = name;
        this.coords = coords;
        this.affectedTiles = [];
        this.bitmap = bitmap;

        const end = new PixelCoords(coords.tile, coords.x + bitmap.width, coords.y + bitmap.height);

        for (let i = this.coords.tile.x; i <= end.tile.x; i++)
            for (let j = this.coords.tile.y; j <= end.tile.y; j++)
                this.affectedTiles.push(TileCoords.toIndex(i, j));
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D) {
        ctx.drawImage(this.bitmap,
            this.coords.tile.x * 1000 + this.coords.x - tile.x * 1000,
            this.coords.tile.y * 1000 + this.coords.y - tile.y * 1000);
    }
}
