import { TileIndex } from './types';

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
    readonly tile: TileCoords;
    readonly x: number;
    readonly y: number;

    constructor(tile: TileCoords, x: number, y: number) {
        this.tile = new TileCoords(tile.x + Math.floor(x / 1000),
                                   tile.y + Math.floor(y / 1000));

        this.x = x % 1000;
        this.y = y % 1000;
    }

    toString() {
        return `[${this.tile.x}, ${this.tile.y} ; ${this.x}, ${this.y}]`;
    }
}