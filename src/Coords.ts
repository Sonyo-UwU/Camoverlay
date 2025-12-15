import { JsonifiedValue, PixelIndex, TileIndex } from './types';

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
        this.tx = (Math.floor(tx) + Math.floor(px / 1000)) % 2048;
        this.ty = (Math.floor(ty) + Math.floor(py / 1000)) % 2048;

        this.px = px % 1000;
        this.py = py % 1000;
    }

    static copy(o: JsonifiedValue<PixelCoords>): PixelCoords {
        return new PixelCoords(o.tx, o.ty, o.px, o.py);
    }

    toGeoCoords(center = true): [number, number] {
        const offset = center ? 0.5 : 0;
        const relativeX = (this.tx * 1000 + this.px + offset) / (2048 * 1000);
        const relativeY = 1 - (this.ty * 1000 + this.py + offset) / (2048 * 1000);
        return [
            relativeX * 360 - 180,
            360 * Math.atan(Math.exp((relativeY * 2 - 1) * Math.PI)) / Math.PI - 90
        ];
    }

    static toIndex(tx: number, ty: number, px: number, py: number): PixelIndex {
        return (tx * 10000 + ty) * 1000000 + (px * 1000 + py);
    }

    static fromIndex(i: PixelIndex): PixelCoords {
        return new PixelCoords(Math.floor(i / 10000 / 1000000), Math.floor(i / 1000000) % 10000, Math.floor(i / 1000) % 1000, i % 1000);
    }

    toIndex(): PixelIndex {
        return PixelCoords.toIndex(this.tx, this.ty, this.px, this.py);
    }

    toTileIndex(): TileIndex {
        return TileCoords.toIndex(this.tx, this.ty);
    }

    toString() {
        return `[${this.tx}, ${this.ty} ; ${this.px}, ${this.py}]`;
    }
}