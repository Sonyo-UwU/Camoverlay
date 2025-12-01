import { PixelCoords, TileCoords } from './Coords';
import { addColorRow, addTemplateRow, displayStatus, removeTemplateRow } from './display';
import Template from './Template';
import { JsonifiedValue, TileIndex, TileInfo, WplaceColorId } from './types';

declare type StorageValues = {
    'global': { inputCoords: PixelCoords | null, enabledColors: [WplaceColorId, boolean][] },
    'templates': Template[];
};

declare function GM_getValue(key: keyof StorageValues, defaultValue?: null): string | null;
declare function GM_setValue(key: keyof StorageValues, value: string): void;

class ManagerClass {
    readonly patternSize: number = 3;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;
    enabledColors: Map<WplaceColorId, boolean>;
    lastClickedCoords: PixelCoords | null;

    setInputCoords(value: PixelCoords | null) {
        (document.getElementById('ca-input-tx') as HTMLInputElement).value = value?.tx.toString() ?? '';
        (document.getElementById('ca-input-ty') as HTMLInputElement).value = value?.ty.toString() ?? '';
        (document.getElementById('ca-input-px') as HTMLInputElement).value = value?.px.toString() ?? '';
        (document.getElementById('ca-input-py') as HTMLInputElement).value = value?.py.toString() ?? '';
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
        this.enabledColors = new Map();
        this.lastClickedCoords = null;
    }

    static #loadValue<K extends keyof StorageValues>(key: K): JsonifiedValue<StorageValues[K]> | null {
        return JSON.parse(GM_getValue(key, null)!);
    }

    static #storeValue<K extends keyof StorageValues>(key: K, value: StorageValues[K]): void {
        GM_setValue(key, JSON.stringify(value));
    }

    loadGlobals(): void {
        const stored = ManagerClass.#loadValue('global');
        if (stored === null)
            return;

        if (stored.inputCoords) {
            this.lastClickedCoords = PixelCoords.copy(stored.inputCoords);
            this.setInputCoords(this.lastClickedCoords);
        }

        this.enabledColors = new Map(stored.enabledColors);
    }

    storeGlobal(overrides?: Partial<StorageValues['global']>): void {
        ManagerClass.#storeValue('global', {
            inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
            enabledColors: this.enabledColors.entries().toArray()
        });
    }

    async loadTemplates(): Promise<void> {
        const stored = ManagerClass.#loadValue('templates');
        if (!stored)
            return;

        while (this.templates.length > 0)
            this.deleteTemplate(0);

        for (const storedTemplate of stored) {
            const template = await Template.fromStorage(storedTemplate);
            this.resetTiles(template.overlappedTiles);
            this.templates.push(template);
            addTemplateRow(template);
        }

        this.rebuildColorList();
        displayStatus('Loaded ' + this.templates.length + ' templates');
    }

    storeTemplates(): void {
        ManagerClass.#storeValue('templates', this.templates);
    }

    resetTiles(indices: number[]): void {
        for (const index of indices)
            this.tilesInfo.delete(index);
    }

    async createTemplate(coords: PixelCoords, file: File): Promise<Template> {
        let name = file.name.slice(0, file.name.lastIndexOf('.'));
        if (name.startsWith('converted_'))
            name = name.substring(10);

        for (let i = 0; i < this.templates.length; i++)
            if (this.templates[i]!.name === name) {
                this.deleteTemplate(i);
                i--;
            }

        const start = performance.now();
        const template = await Template.fromFile(name, coords, file);
        const time = performance.now() - start;
        console.log('Created template in ' + time + 'ms');

        this.resetTiles(template.overlappedTiles);

        this.templates.push(template);
        this.storeTemplates();

        addTemplateRow(template);
        this.rebuildColorList();
        displayStatus('Created template at ' + template.coords.toString() + ': ' + template.totalPixelCount + ' pixels');
        return template;
    }

    deleteTemplate(index: number): void {
        const template = this.templates[index];
        if (template === undefined)
            return;

        this.resetTiles(template.overlappedTiles);
        this.templates.splice(index, 1);
        this.storeTemplates();

        removeTemplateRow(template.name);
        this.rebuildColorList();
    }

    rebuildColorList() {
        const list = document.getElementById('ca-color-list')!;
        while (list.firstChild)
            list.firstChild!.remove();

        const colorCounts = new Map<WplaceColorId, number>();

        for (const template of this.templates) {
            if (template.enabled)
                for (const [id, count] of template.colorsInfo)
                    colorCounts.set(id, (colorCounts.get(id) ?? 0) + count);
        }

        for (const id of this.enabledColors.keys()) {
            if (!colorCounts.has(id))
                this.enabledColors.delete(id);
        }

        for (const [id, count] of colorCounts.entries().toArray().sort((a, b) => b[1] - a[1])) {
            addColorRow(id, count, this.enabledColors.get(id) ?? true);
        }
    }

    async processTile(tile: TileCoords, response: Response): Promise<Response> {
        const lastModified = new Date(response.headers.get('last-modified') ?? 0).getTime();

        const tileIndex = tile.toIndex();

        // Check if any template overlaps
        let overlap = false;
        for (const template of this.templates) {
            if (template.enabled && template.overlaps(tileIndex)) {
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
        let allDisabled = true;
        for (const enabled of Manager.enabledColors.values()) {
            if (enabled) {
                allDisabled = false;
                break;
            }
        }

        if (allDisabled)
            return blob;

        const canvas = new OffscreenCanvas(this.patternSize * 1000, this.patternSize * 1000);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);


        for (const template of this.templates) {
            if (template.enabled)
                template.drawOnTile(tile, ctx);
        }

        return await canvas.convertToBlob();
    }
}

export const Manager = new ManagerClass();
