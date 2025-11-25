import { PixelCoords, TileCoords } from './Coords';
import { displayStatus, setInputCoords } from './display';
import Template from './Template';
import { JsonifiedValue, TileIndex, TileInfo } from './types';

declare type StorageValues = {
    'global': { inputCoords: PixelCoords | null },
    'templates': Template[];
};

declare function GM_getValue(key: keyof StorageValues, defaultValue?: null): string | null;
declare function GM_setValue(key: keyof StorageValues, value: string): void;

class ManagerClass {
    readonly patternSize: number = 3;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;
    disabled: boolean;
    lastClickedCoords: PixelCoords | null = null;

    setInputCoords(value: PixelCoords | null) {
        if (value !== null)
            setInputCoords(value);
        this.storeGlobal({ inputCoords: value });
    };
    getInputCoords(): PixelCoords | null {
        const tx = parseInt((document.getElementById('ca-input-tx') as HTMLInputElement).value);
        const ty = parseInt((document.getElementById('ca-input-ty') as HTMLInputElement).value);
        const px = parseInt((document.getElementById('ca-input-px') as HTMLInputElement).value);
        const py = parseInt((document.getElementById('ca-input-py') as HTMLInputElement).value);

        if (isNaN(tx) || isNaN(ty) || isNaN(px) || isNaN(py)) {
            return null;
        }

        return new PixelCoords(tx, ty, px, py);
    };


    constructor() {
        this.templates = [];
        this.tilesInfo = new Map();
        this.disabled = false;
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
            this.lastClickedCoords = PixelCoords.copy(stored.inputCoords);
            this.setInputCoords(this.lastClickedCoords);
        }
    }

    storeGlobal(overrides?: Partial<StorageValues['global']>): void {
        ManagerClass.#storeValue('global', {
            inputCoords: overrides?.inputCoords ?? this.getInputCoords()
        });
    }

    async loadTemplates(): Promise<void> {
        const stored = ManagerClass.#loadValue('templates');
        if (!stored)
            return;

        for (let i = 0; i < this.templates.length; i++)
            this.templates[0]!.bitmap?.close();
        this.templates = [];

        for (const storedTemplate of stored) {
            const template = await Template.fromStorage(storedTemplate);
            this.templates.push(template);
            displayStatus('Loaded template at ' + template.coords.toString() + ': ' + template.totalPixelCount + ' pixels');
        }
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
        displayStatus('Created template at ' + template.coords.toString() + ': ' + template.totalPixelCount + ' pixels');
        return template;
    }

    async processTile(tile: TileCoords, response: Response): Promise<Response> {
        // Exit early if disabled
        if (this.disabled)
            return response;

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
