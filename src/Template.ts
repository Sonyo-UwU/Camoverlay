import { Coords, FullCoords } from './types';

export default class Template {
    name: string;
    coords: FullCoords;
    bitmap: ImageBitmap;


    constructor(name: string, coords: FullCoords, bitmap: ImageBitmap) {
        this.name = name;
        this.coords = coords;
        this.bitmap = bitmap;
    }

    drawOnTile(coords: Coords, ctx: OffscreenCanvasRenderingContext2D) {
        ctx.drawImage(this.bitmap,
            this.coords.tile.x * 1000 + this.coords.pixel.x - coords.x * 1000,
            this.coords.tile.y * 1000 + this.coords.pixel.y - coords.y * 1000);
    }
}
