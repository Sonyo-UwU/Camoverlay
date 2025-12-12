import { JsonifiedValue, TileIndex } from './types';

export class TileCoords {
    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number) {
        this.x = Math.floor(x) % 2048;
        this.y = Math.floor(y) % 2048;
    }

    static toIndex(x: number, y: number): TileIndex {
        return x * 10000 + y;
    }

    toIndex(): TileIndex {
        return TileCoords.toIndex(this.x, this.y);
    }

    toString() {
        return `[${this.x}, ${this.y}]`;
    }
};

export class PixelCoords {
    readonly tx: number;
    readonly ty: number
    readonly px: number;
    readonly py: number;

    constructor(tx: number, ty: number, px: number, py: number) {
        this.tx = (Math.floor(tx) + Math.floor(px / 1000)) % 2048;
        this.ty = (Math.floor(ty) + Math.floor(py / 1000)) % 2048;

        this.px = Math.floor(px) % 1000;
        this.py = Math.floor(py) % 1000;
    }

    static copy(o: JsonifiedValue<PixelCoords>): PixelCoords {
        return new PixelCoords(o.tx, o.ty, o.px, o.py);
    }

    toTileIndex(): TileIndex {
        return TileCoords.toIndex(this.tx, this.ty);
    }

    toString() {
        return `[${this.tx}, ${this.ty} ; ${this.px}, ${this.py}]`;
    }
}