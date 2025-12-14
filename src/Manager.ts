import { PixelCoords, TileCoords } from './Coords';
import { addColorRow, addTemplateRow, displayStatus, removeTemplateRow } from './display';
import Template from './Template';
import { ColorInfo, JsonifiedValue, TileIndex, TileInfo, TileProgress, WplaceColorId } from './types';
import { ColorSortingOptions } from './utils';

declare type StorageValues = {
    'global': { inputCoords: PixelCoords | null, colorSorting: ColorSortingOptions, enabledColors: [WplaceColorId, boolean][] },
    'templates': Template[];
};

declare function GM_getValue(key: keyof StorageValues, defaultValue?: null): string | null;
declare function GM_setValue(key: keyof StorageValues, value: string): void;

class ManagerClass {
    readonly patternSize: number = 3;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;
    colorsInfo: Map<WplaceColorId, ColorInfo>;
    lastClickedCoords: PixelCoords | null;
    colorSorting: ColorSortingOptions;
    flyCoords: PixelCoords | null;
    loggedIn: boolean;
    settings: { wrongHighlight: boolean };

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
        this.colorsInfo = new Map();
        this.lastClickedCoords = null;
        this.colorSorting = ColorSortingOptions.Total;
        this.flyCoords = null;
        this.loggedIn = false;
        this.settings = {
            wrongHighlight: false
        };
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

        this.colorSorting = stored.colorSorting || ColorSortingOptions.Total;
        this.colorsInfo = new Map(stored.enabledColors.map(([id, enabled]) => [id, { enabled: enabled, unpainted: null }]));
    }

    storeGlobal(overrides?: Partial<StorageValues['global']>): void {
        ManagerClass.#storeValue('global', {
            inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
            colorSorting: this.colorSorting,
            enabledColors: this.colorsInfo.entries().toArray().map(([id, colorInfo]) => [id, colorInfo.enabled])
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
            this.resetTiles(template.tiles.keys());
            this.templates.push(template);
            addTemplateRow(template);
        }

        this.rebuildColorList();
        displayStatus('Loaded ' + this.templates.length + ' templates');
    }

    storeTemplates(): void {
        ManagerClass.#storeValue('templates', this.templates);
    }

    resetTiles(indices: Iterable<number>): void {
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

        this.resetTiles(template.tiles.keys());

        this.templates.push(template);
        this.storeTemplates();

        addTemplateRow(template);
        this.rebuildColorList();
        displayStatus('Created template at ' + template.coords.toString() + ': ' + template.totalProgress.total + ' pixels');
        return template;
    }

    deleteTemplate(index: number): void {
        const template = this.templates[index];
        if (template === undefined)
            return;

        this.resetTiles(template.tiles.keys());
        this.templates.splice(index, 1);
        this.storeTemplates();

        removeTemplateRow(template.name);
        this.rebuildColorList();
    }

    rebuildColorList() {
        const list = document.getElementById('ca-color-list')!;
        while (list.firstChild)
            list.firstChild!.remove();

        const colorProgress = new Map<WplaceColorId, TileProgress>();
        
        for (const template of this.templates) {
            if (template.enabled)
                for (const [_, colors] of template.tiles)
                    for (const [id, progress] of colors) {
                        let totalProgress = colorProgress.get(id);
                        if (totalProgress === undefined) {
                            totalProgress = { total: 0, unpainted: 0, wrong: 0 };
                            colorProgress.set(id, totalProgress);
                        }
                        totalProgress.total += progress.total;
                        totalProgress.unpainted += progress.unpainted;
                        totalProgress.wrong += progress.wrong;
                    }
        }

        for (const id of this.colorsInfo.keys()) {
            if (!colorProgress.has(id))
                this.colorsInfo.delete(id);
        }

        const colorsArray = colorProgress.entries().toArray();
        switch (Manager.colorSorting) {
            case ColorSortingOptions.Total:
                colorsArray.sort((a, b) => b[1].total - a[1].total);
                break;
            case ColorSortingOptions.Remaining:
                colorsArray.sort((a, b) => b[1].unpainted + b[1].wrong - a[1].unpainted - a[1].wrong);
                break;
            case ColorSortingOptions.Wrong:
                colorsArray.sort((a, b) => b[1].wrong - a[1].wrong);
                break;

            default:
                const n: never = Manager.colorSorting;
                n;
        }

        for (const [id, progress] of colorsArray) {
            if (!this.colorsInfo.has(id))
                this.colorsInfo.set(id, { enabled: true, unpainted: null });
            addColorRow(id, progress);
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
        let tileInfo = this.tilesInfo.get(tileIndex);
        if (tileInfo === undefined) {
            tileInfo = {
                lastModified: 0,
                blob: null
            };
            this.tilesInfo.set(tileIndex, tileInfo);
        }


        let modifiedBlob = tileInfo.blob;
        // Update if necessary
        if (modifiedBlob === null || tileInfo.lastModified < lastModified || response.type === 'basic') {
            const blob = await response.blob();

            const trackProgress = response.type !== 'basic' || modifiedBlob === null;
            modifiedBlob = await this.drawOnTile(tile, blob, trackProgress);

            if (trackProgress) {
                this.rebuildColorList();
                tileInfo.blob = modifiedBlob;
                tileInfo.lastModified = lastModified;
            }
        }


        // Return the result
        return new Response(modifiedBlob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        });
    }

    async drawOnTile(tile: TileCoords, blob: Blob, trackProgress: boolean): Promise<Blob> {
        let allDisabled = true;
        for (const enabled of Manager.colorsInfo.values()) {
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
                template.drawOnTile(tile, ctx, trackProgress);
        }

        return await canvas.convertToBlob();
    }

    flyTo(coords: PixelCoords) {
        Manager.flyCoords = coords;
        (document.getElementsByClassName('btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom before:-translate-x-1/3')[0] as HTMLElement)?.click();
        Manager.flyCoords = null;
        setTimeout(() => (document.getElementsByClassName('group relative')[0]?.lastElementChild?.firstElementChild as HTMLElement | undefined)?.click());
    }
}

export const Manager = new ManagerClass();
