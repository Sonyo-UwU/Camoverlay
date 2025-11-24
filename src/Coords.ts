import { JsonifiedValue, TileIndex } from './types';

export class TileCoords {
    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number) {
        this.x = x % 2048;
        this.y = y % 2048;
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
        this.tx = (tx + Math.floor(px / 1000)) % 2048;
        this.ty = (ty + Math.floor(py / 1000)) % 2048;

        this.px = px % 1000;
        this.py = py % 1000;
    }

    static copy(o: JsonifiedValue<PixelCoords>): PixelCoords {
        return new PixelCoords(o.tx, o.ty, o.px, o.py);
    }

    toString() {
        return `[${this.tx}, ${this.ty} ; ${this.px}, ${this.py}]`;
    }
}