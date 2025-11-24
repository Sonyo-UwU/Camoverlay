import { PixelCoords, TileCoords } from './Coords';
import { setPixelCoords } from './display';
import Template from './Template';
import { JsonifiedValue, TileIndex, TileInfo } from './types';

declare type StorageValues = {
    'global': Pick<ManagerClass, 'inputCoords'>,
    'templates': Template[];
};

declare function GM_getValue(key: keyof StorageValues, defaultValue?: null): string | null;
declare function GM_setValue(key: keyof StorageValues, value: string): void;

class ManagerClass {
    lastClickedCoords: PixelCoords | null = null;
    #inputCoords: PixelCoords | null = null;
    set inputCoords(value: PixelCoords | null) {
        this.#inputCoords = value;
        this.storeGlobal();
    };
    get inputCoords() {
        return this.#inputCoords;
    };

    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;
    readonly patternSize: number = 3;

    constructor() {
        this.templates = [];
        this.tilesInfo = new Map();
    }

    static #loadValue<K extends keyof StorageValues>(key: K): JsonifiedValue<StorageValues[K]> | null {
        return JSON.parse(GM_getValue(key, null)!);
    }

    static #storeValue<K extends keyof StorageValues>(key: K, value: StorageValues[K]): void {
        GM_setValue(key, JSON.stringify(value));
    }

    loadGlobals(): void {
        const stored = ManagerClass.#loadValue('global');
        if (stored && stored.inputCoords) {
            this.#inputCoords = PixelCoords.copy(stored.inputCoords);
            this.lastClickedCoords = this.#inputCoords;
            setPixelCoords(this.lastClickedCoords);
        }
    }

    storeGlobal(): void {
        ManagerClass.#storeValue('global', {
            inputCoords: this.inputCoords
        });
    }

    async loadTemplates(): Promise<void> {
        const stored = ManagerClass.#loadValue('templates');
        if (!stored)
            return;

        debugger;
        for (let i = 0; i < this.templates.length; i++)
            this.templates[0]!.bitmap?.close();
        this.templates = [];

        for (const storedTemplate of stored) {
            const template = await Template.fromBase64(storedTemplate.name, PixelCoords.copy(storedTemplate.coords), storedTemplate.base64Data);
            this.templates.push(template);
        }

        this.storeTemplates();
    }

    storeTemplates(): void {
        ManagerClass.#storeValue('templates', this.templates);
    }

    async createTemplate(coords: PixelCoords, file: File): Promise<Template> {
        const start = performance.now();
        const template = await Template.fromFile(file.name, coords, file);
        const time = performance.now() - start;
        console.log('Created template in ' + time + 'ms');

        for (const index of template.overlappedTiles) {
            this.tilesInfo.delete(index);
        }

        //this.templates.push(template);
        this.templates = [template];
        this.storeTemplates();
        return template;
    }

    async processTile(tile: TileCoords, response: Response): Promise<Response> {
        const lastModified = new Date(response.headers.get('last-modified') ?? 0).getTime();

        const tileIndex = tile.toIndex();

        // Check if any template overlaps
        let overlap = false;
        for (const template of this.templates) {
            if (template.overlaps(tileIndex)) {
                overlap = true;
                break;
            }
        }
        if (!overlap)
            return response;


        // Get or create TileInfo
        let tileInfo: TileInfo;
        if (this.tilesInfo.has(tileIndex)) {
            tileInfo = this.tilesInfo.get(tileIndex)!;
        }
        else {
            tileInfo = {
                lastModified: 0,
                blob: null
            };
            this.tilesInfo.set(tileIndex, tileInfo);
        }


        // Update if necessary
        if (tileInfo.blob === null || tileInfo.lastModified < lastModified) {
            const blob = await response.blob();
            const modifiedBlob = await this.drawOnTile(tile, blob);
            tileInfo.blob = modifiedBlob;
            tileInfo.lastModified = lastModified;
        }


        // Return the result
        return new Response(tileInfo.blob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        });
    }

    async drawOnTile(tile: TileCoords, blob: Blob): Promise<Blob> {
        const canvas = new OffscreenCanvas(this.patternSize * 1000, this.patternSize * 1000);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);

        for (const template of this.templates) {
            template.drawOnTile(tile, ctx);
        }

        return await canvas.convertToBlob();
    }
}

export const Manager = new ManagerClass();
