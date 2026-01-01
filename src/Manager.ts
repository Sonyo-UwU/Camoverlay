import { PixelCoords, TileCoords } from './Coords';
import { addColorRow, addTemplateRow, displayStatus, removeTemplateRow } from './display';
import { addCanvasListeners } from './eventListeners';
import { MessageCreateTemplate, MessageDrawOnTile, MessageInit, WorkerResponse } from './Messages';
import Template from './Template';
import { JsonifiedValue, PixelIndex, PromiseResolve, TeleportPixels, TileIndex, TileInfo, TileProgress, UserSettings, WplaceColorId, WplaceMap } from './types';
import { ColorSortingOptions, computeHue, computeLuminance, functionBody, getZoomLevelForPixelSize, rgbColorMap } from './utils';
import { workerFunction } from './worker';

declare type StorageValues = {
    'global': {
        inputCoords: PixelCoords | null;
        settings: UserSettings;
        enabledColors: [WplaceColorId, boolean][];
    };
    'templates': Template[];
};

declare function GM_getValue(key: keyof StorageValues, defaultValue?: null): string | null;
declare function GM_setValue(key: keyof StorageValues, value: string): void;
declare const unsafeWindow: typeof window;

class ManagerClass {
    readonly patternSize: number = 3;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;
    enabledColors: Map<WplaceColorId, boolean>;
    teleportCurrentIndex: number;
    lastClickedCoords: PixelCoords | null;
    loggedIn: boolean;
    userFullCharges: Date;
    settings: UserSettings;
    wplaceMap: WplaceMap | null;
    worker!: Worker;
    workerCreateTemplateResolve: Map<string, PromiseResolve<MessageCreateTemplate['response']['data']>>;
    workerDrawOnTileResolve: Map<string, PromiseResolve<MessageDrawOnTile['response']['data']>>;

    setInputCoords(value: PixelCoords | null, store: boolean = true) {
        (document.getElementById('ca-input-tx') as HTMLInputElement).value = value?.tx.toString() ?? '';
        (document.getElementById('ca-input-ty') as HTMLInputElement).value = value?.ty.toString() ?? '';
        (document.getElementById('ca-input-px') as HTMLInputElement).value = value?.px.toString() ?? '';
        (document.getElementById('ca-input-py') as HTMLInputElement).value = value?.py.toString() ?? '';
        if (store)
            this.storeGlobal({ inputCoords: value });
    }
    getInputCoords(): PixelCoords | null {
        const tx = parseInt((document.getElementById('ca-input-tx') as HTMLInputElement).value);
        const ty = parseInt((document.getElementById('ca-input-ty') as HTMLInputElement).value);
        const px = parseInt((document.getElementById('ca-input-px') as HTMLInputElement).value);
        const py = parseInt((document.getElementById('ca-input-py') as HTMLInputElement).value);

        if (isNaN(tx) || isNaN(ty) || isNaN(px) || isNaN(py)) {
            return null;
        }

        return new PixelCoords(tx, ty, px, py);
    }


    constructor() {
        this.templates = [];
        this.tilesInfo = new Map();
        this.enabledColors = new Map();
        this.teleportCurrentIndex = 0;
        this.lastClickedCoords = null;
        this.loggedIn = false;
        this.userFullCharges = new Date();
        this.settings = {
            colorSorting: ColorSortingOptions.Total,
            colorSortingReversed: false,
            uiSize: '100',
            hideCompleted: false
        };
        this.wplaceMap = null;
        this.workerCreateTemplateResolve = new Map();
        this.workerDrawOnTileResolve = new Map();
    }

    static #loadValue<K extends keyof StorageValues>(key: K): JsonifiedValue<StorageValues[K]> | null {
        return JSON.parse(GM_getValue(key, null)!);
    }

    static #storeValue<K extends keyof StorageValues>(key: K, value: StorageValues[K]): void {
        GM_setValue(key, JSON.stringify(value));
    }

    loadGlobals(): void {
        const stored = ManagerClass.#loadValue('global');
        if (stored == null)
            return;

        if (stored.inputCoords != null) {
            this.lastClickedCoords = PixelCoords.copy(stored.inputCoords as any);
            this.setInputCoords(this.lastClickedCoords, false);
        }

        if (stored.settings !== undefined) {
            if (stored.settings.colorSorting !== undefined)
                this.settings.colorSorting = stored.settings.colorSorting;
            (document.getElementById('ca-sort-select') as HTMLSelectElement).value = this.settings.colorSorting;

            if (stored.settings.colorSortingReversed !== undefined)
                this.settings.colorSortingReversed = stored.settings.colorSortingReversed;

            if (stored.settings.uiSize !== undefined)
                this.settings.uiSize = stored.settings.uiSize;
            (document.getElementById('ca-setting-ui-size') as HTMLInputElement).value = this.settings.uiSize;
            (document.getElementById('ca-overlay') as HTMLDivElement).style.setProperty('--ca-ui-size', this.settings.uiSize + '%');

            if (stored.settings.hideCompleted !== undefined)
                this.settings.hideCompleted = stored.settings.hideCompleted;
            (document.getElementById('ca-setting-hide-completed') as HTMLInputElement).checked = this.settings.hideCompleted;
        }

        if (stored.enabledColors !== undefined)
            this.enabledColors = new Map(stored.enabledColors);
    }

    storeGlobal(overrides?: Partial<StorageValues['global']>): void {
        ManagerClass.#storeValue('global', {
            inputCoords: overrides?.inputCoords ?? this.getInputCoords(),
            settings: this.settings,
            enabledColors: this.enabledColors.entries().toArray()
        });
    }

    async loadTemplates(): Promise<void> {
        const stored = ManagerClass.#loadValue('templates');
        if (!stored)
            return;

        for (const template of this.templates)
            removeTemplateRow(template.name);
        this.templates = [];
        this.tilesInfo.clear();

        for (const storedTemplate of stored) {
            const template = await Template.fromStorage(storedTemplate);
            if (template === null)
                continue;

            this.templates.push(template);
            addTemplateRow(template);
        }

        this.rebuildColorList();
        displayStatus('Loaded ' + this.templates.length + ' templates');
    }

    storeTemplates(): void {
        ManagerClass.#storeValue('templates', this.templates);
    }

    deleteTiles(): void;
    deleteTiles(index: TileIndex): void;
    deleteTiles(indices: Iterable<TileIndex>): void;
    deleteTiles(indices?: TileIndex | Iterable<TileIndex>): void {
        if (indices === undefined)
            indices = this.tilesInfo.keys();
        else if (!(Symbol.iterator in indices)) {
            indices = [indices];
        }
    
        for (const index of indices)
            this.tilesInfo.delete(index);

        this.wplaceMap?.refreshTiles('pixel-art-layer');
    }

    refreshTiles(): void;
    refreshTiles(index: TileIndex): void;
    refreshTiles(indices: Iterable<TileIndex>): void;
    refreshTiles(indices?: TileIndex | Iterable<TileIndex>): void {
        if (indices === undefined)
            indices = this.tilesInfo.keys();
        else if (!(Symbol.iterator in indices)) {
            indices = [indices];
        }

        for (const index of indices) {
            const info = this.tilesInfo.get(index);
            if (info !== undefined)
                info.shouldUseOrig = true;
        }

        this.wplaceMap?.refreshTiles('pixel-art-layer');
    }

    async createWorker(): Promise<void> {
        const lzstring = await fetch('https://cdn.jsdelivr.net/gh/pieroxy/lz-string/libs/lz-string.min.js').then(r => r.text());
        const script = lzstring + functionBody(workerFunction.toString());
        const blob = new Blob([script], { type: 'text/javascript' });
        const blobURL = URL.createObjectURL(blob);
        this.worker = new unsafeWindow.Worker(blobURL);
        URL.revokeObjectURL(blobURL);

        this.worker.onmessage = ManagerClass.workerMessage;
        this.workerInit();
    }

    static workerMessage(e: MessageEvent) {
        // Can't use `this` here, the context is the Worker
        const m = e.data as WorkerResponse;
        switch (m.name) {
            case 'CreateTemplate':
                Manager.workerCreateTemplateResolve.get(m.data.name)?.(m.data);
                break;
            case 'TemplateFromStorage':
                // Error while creating template
                const index = Manager.templates.findIndex(t => t.name === m.data.name);
                if (index !== -1)
                    Manager.deleteTemplate(index);
                break;
            case 'ComputeBase64Data':
                const template = Manager.templates.find(t => t.name === m.data.name);
                if (template === undefined)
                    break;

                template.base64Data = m.data.base64Data;
                Manager.storeTemplates();
                break;
            case 'DrawOnTile':
                Manager.workerDrawOnTileResolve.get(m.data.key)?.(m.data);
                break;
            default:
                const n: never = m;
                n;
                break;
        }
    }

    workerInit() {
        const initMessage: MessageInit['message'] = {
            name: 'Init',
            data: {
                rgbColorMap: rgbColorMap.entries().toArray().map(([id, c]) => [id, { id: c.id, rgb: c.rgb }])
            }
        };

        this.worker.postMessage(initMessage);
    }

    async createTemplate(coords: PixelCoords, file: File): Promise<void> {
        let name = file.name.slice(0, file.name.lastIndexOf('.'));
        if (name.startsWith('converted_'))
            name = name.substring(10);

        for (let i = 0; i < this.templates.length; i++)
            if (this.templates[i]!.name === name) {
                this.deleteTemplate(i);
                i--;
            }

        displayStatus('Creating template...');

        const start = performance.now();
        const template = await Template.fromFile(name, coords, file);
        const time = performance.now() - start;
        console.log('Created template in ' + time + 'ms');

        if (template === null) {
            displayStatus('Failed creating template');
            return;
        }

        this.refreshTiles(template.tiles.keys());

        this.templates.push(template);
        // Don't store now, wait for the base64 data

        addTemplateRow(template);
        this.rebuildColorList();
        displayStatus('Created template at ' + template.coords.toString() + ': ' + template.totalProgress.total + ' pixels');
    }

    deleteTemplate(index: number): void {
        const template = this.templates[index];
        if (template === undefined)
            return;

        this.deleteTiles(template.tiles.keys());
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

        let anyWrong: boolean = false;

        for (const template of this.templates) {
            if (template.enabled)
                for (const [_, colors] of template.tiles)
                    for (const [id, progress] of colors) {
                        if (progress.total === 0)
                            continue;

                        let totalProgress = colorProgress.get(id);
                        if (totalProgress === undefined) {
                            totalProgress = { total: 0, unpainted: 0, wrong: 0 };
                            colorProgress.set(id, totalProgress);
                        }
                        totalProgress.total += progress.total;
                        totalProgress.unpainted += progress.unpainted;
                        totalProgress.wrong += progress.wrong;

                        if (totalProgress.wrong > 0)
                            anyWrong = true;
                    }
        }

        for (const id of this.enabledColors.keys()) {
            if (!colorProgress.has(id))
                this.enabledColors.delete(id);
        }

        const colorsArray = colorProgress.entries().toArray();
        switch (this.settings.colorSorting) {
            case ColorSortingOptions.Total:
                colorsArray.sort((a, b) => b[1].total - a[1].total);
                break;
            case ColorSortingOptions.Remaining:
                colorsArray.sort((a, b) => b[1].unpainted + b[1].wrong - a[1].unpainted - a[1].wrong);
                break;
            case ColorSortingOptions.Wrong:
                colorsArray.sort((a, b) => b[1].wrong - a[1].wrong);
                break;
            case ColorSortingOptions.Progress:
                colorsArray.sort((a, b) => ((b[1].total - b[1].unpainted - b[1].wrong) / b[1].total) - ((a[1].total - a[1].unpainted - a[1].wrong) / a[1].total));
                break;
            case ColorSortingOptions.Original:
                colorsArray.sort((a, b) => rgbColorMap.get(a[0])!.wplaceOrder - rgbColorMap.get(b[0])!.wplaceOrder);
                break;
            case ColorSortingOptions.Luminance:
                colorsArray.sort((a, b) => computeLuminance(a[0]) - computeLuminance(b[0]));
                break;
            case ColorSortingOptions.Hue:
                colorsArray.sort((a, b) => computeHue(b[0]) - computeHue(a[0]));
                break;

            default:
                const n: never = this.settings.colorSorting;
                n;
        }

        if (this.settings.colorSortingReversed)
            colorsArray.reverse();

        for (const [id, progress] of colorsArray) {
            if (!this.enabledColors.has(id))
                this.enabledColors.set(id, true);

            if (!this.settings.hideCompleted || ((this.settings.colorSorting === ColorSortingOptions.Wrong && anyWrong) ? 0 : progress.unpainted) + progress.wrong > 0)
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
                shouldUseOrig: false,
                origBlob: null,
                fullBlob: null
            };
            this.tilesInfo.set(tileIndex, tileInfo);
        }


        let modifiedBlob = tileInfo.fullBlob;
        // Update if necessary
        if (modifiedBlob === null || tileInfo.lastModified < lastModified || response.type === 'basic') {
            const blob = await response.blob();

            const trackProgress = response.type !== 'basic' || modifiedBlob === null;
            modifiedBlob = await this.drawOnTile(tile, blob, trackProgress);

            if (trackProgress) {
                this.rebuildColorList();
                tileInfo.origBlob = blob;
                tileInfo.fullBlob = modifiedBlob;
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

    async processTileFromOrig(tile: TileCoords): Promise<Response> {
        const tileInfo = this.tilesInfo.get(tile.toIndex())!;
        tileInfo.shouldUseOrig = false;

        const modifiedBlob = await this.drawOnTile(tile, tileInfo.origBlob!, false);

        tileInfo.fullBlob = modifiedBlob;

        return new Response(modifiedBlob, {
            headers: new Headers([['content-type', 'image/png'], ['content-length', modifiedBlob.size.toString()]]),
            status: 200
        });
    }

    async drawOnTile(tile: TileCoords, blob: Blob, trackProgress: boolean): Promise<Blob> {
        let allDisabled = true;
        for (const enabled of this.enabledColors.values()) {
            if (enabled === true) {
                allDisabled = false;
                break;
            }
        }

        if (allDisabled && !trackProgress)
            return blob;

        let canvas = new OffscreenCanvas(this.patternSize * 1000, this.patternSize * 1000);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);


        for (const template of this.templates)
            if (template.enabled)
                await template.drawOnTile(tile, ctx, trackProgress);

        return await canvas.convertToBlob();
    }

    /* Snipet inspired from https://github.com/t-wy/Wplace-BlueMarble-Userscripts/tree/custom-improve */
    async getMapObject(): Promise<void> {
        // Hook Map.values function
        const origMapValues = Map.prototype.values;
        const hookedMapValues = function (this: Map<any, any>): MapIterator<any> {
            this.forEach(v => {
                if (v?.maps instanceof Set)
                    (v.maps as Set<any>).forEach(x => {
                        if (x?.flyTo) {
                            Manager.wplaceMap = x;
                            Map.prototype.values = origMapValues;
                        }
                    });
            });
            return origMapValues.call(this);
        };
        Map.prototype.values = hookedMapValues;

        // Click on the canvas
        let canvas;
        let i = 0;
        do {
            await new Promise((resolve) => setTimeout(resolve, 500));
            canvas = document.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement | null;
            i++;
        } while (canvas === null && i < 20);

        if (canvas === null)
            return;

        addCanvasListeners(canvas);

        let popup: HTMLButtonElement | null = null;
        while (popup === null) {
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: 0,
                clientY: 0,
                button: 0
            });
            canvas.dispatchEvent(clickEvent);

            // Try to close popup
            let i = 0;
            do {
                await new Promise((resolve) => setTimeout(resolve, 50));
                popup = (document.getElementsByClassName('rounded-t-box bg-base-100 border-base-300 sm:rounded-b-box w-full border-t pt-2 sm:mb-3 sm:shadow-xl')[0]
                    ?.firstElementChild?.firstElementChild?.lastElementChild ?? null) as HTMLButtonElement | null;
                i++;
            } while (popup === null && i < 10);
        }
        popup.click();
    }

    flyTo(coords: PixelCoords, zoom: number = 13) {
        this.wplaceMap?.flyTo({ center: coords.toGeoCoords(false), zoom: zoom });
    }
    
    flyToFit(topLeft: PixelCoords, width: number, height: number, extraProportion: number = 1.1): void {
        if (this.wplaceMap === null)
            return;

        const canvas = document.getElementsByClassName('maplibregl-canvas')[0];
        if (canvas === undefined)
            return;

        const xZoom = getZoomLevelForPixelSize(canvas.clientWidth / width / extraProportion);
        const yZoom = getZoomLevelForPixelSize(canvas.clientHeight / height / extraProportion);
        const finalZoom = Math.max(10.7, Math.min(18, xZoom, yZoom));

        this.flyTo(new PixelCoords(topLeft.tx, topLeft.ty, topLeft.px + width / 2, topLeft.py + height / 2), finalZoom);
    }
    
    flyToNextIncorrect(t: TeleportPixels): void {
        let picked: PixelIndex;

        if (t.wrongLocations.length > 0) {
            // Modulo first, because teleportCurrentIndex is global, not per color
            // (makes enumeration start at 1, but doesn't matter since the array is shuffled anyway)
            Manager.teleportCurrentIndex = (Manager.teleportCurrentIndex + 1) % t.wrongLocations.length;
            picked = t.wrongLocations[Manager.teleportCurrentIndex]!;
            }
        else if (t.unpaintedLocations.length > 0) {
            Manager.teleportCurrentIndex = (Manager.teleportCurrentIndex + 1) % t.unpaintedLocations.length;
            picked = t.unpaintedLocations[Manager.teleportCurrentIndex]!;
        }
        else
            return;

        this.flyTo(PixelCoords.fromIndex(picked), 17.5);
    }
}

export const Manager = new ManagerClass();
