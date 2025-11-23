import { PixelCoords, TileCoords } from './Coords';

export default class Template {
    name: string;
    coords: PixelCoords;
    bitmap: ImageBitmap;


    constructor(name: string, coords: PixelCoords, bitmap: ImageBitmap) {
        this.name = name;
        this.coords = coords;
        this.bitmap = bitmap;        
    }

    drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D) {
        ctx.drawImage(this.bitmap,
            this.coords.tile.x * 1000 + this.coords.x - tile.x * 1000,
            this.coords.tile.y * 1000 + this.coords.y - tile.y * 1000);
    }
}
