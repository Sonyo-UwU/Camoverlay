import { PixelCoords, TileCoords } from './Coords';
import { updateTemplatePixelCount } from './display';
import { Manager } from './Manager';
import { MessageComputeBase64Data, MessageCreateTemplate, MessageDrawOnTile, MessageTemplateFromStorage } from './Messages';
import { JsonifiedValue, PixelIndex, TileIndex, TileProgress, WplaceColorId } from './types';

type StoredTemplate = JsonifiedValue<Omit<Template, 'toJSON' | 'imageData' | 'tiles' | 'totalProgress' | 'modifyPixels'> & {
    tiles: [TileIndex, [WplaceColorId, number][]][];
}>;

export default class Template {
    name: string;
    coords: PixelCoords;
    width: number;
    height: number;
    imageData: Uint8ClampedArray | null;
    tiles: Map<TileIndex, Map<WplaceColorId, TileProgress>>;
    totalProgress: TileProgress;
    enabled: boolean;
    base64Data: string;
    modifyPixels: PixelCoords[];


    constructor(name: string, coords: PixelCoords, width: number, height: number) {
        this.name = name;
        this.coords = coords;
        this.width = width;
        this.height = height;
        this.imageData = null;
        this.totalProgress = {
            total: 0,
            unpainted: 0,
            wrong: 0
        };
        this.tiles = new Map();
        this.enabled = true;
        this.base64Data = '';
        this.modifyPixels = [];
    }

    static async fromFile(name: string, coords: PixelCoords, file: File): Promise<Template | null> {
        const bitmap = await createImageBitmap(file);
        const template = new Template(name, coords, bitmap.width, bitmap.height);

        const { promise, resolve, reject } = Promise.withResolvers<MessageCreateTemplate['response']['data']>();
        setTimeout(reject, 60 * 1000);

        Manager.workerCreateTemplateResolve.set(name, resolve);

        const message: MessageCreateTemplate['message'] = {
            name: 'CreateTemplate',
            data: {
                name: name,
                bitmap: bitmap,
                coords: { tx: coords.tx, ty: coords.ty, px: coords.px, py: coords.py }
            }
        };
        Manager.worker.postMessage(message, [bitmap]);

        const result = await promise.catch(() => null); // Wait for worker

        Manager.workerCreateTemplateResolve.delete(name);
        
        if (result === null) {
            return null;
        }

        template.imageData = new Uint8ClampedArray(result.imageData);

        template.tiles = new Map();
        for (const [index, colors] of result.tiles) {
            const progress = new Map<WplaceColorId, TileProgress>();
            for (const [id, total] of colors) {
                progress.set(id, {
                    total: total,
                    unpainted: total,
                    wrong: 0
                });

                template.totalProgress.total += total;
                template.totalProgress.unpainted += total;
            }
            template.tiles.set(index, progress);
        }

        return template;
    }

    static async fromStorage(stored: StoredTemplate): Promise<Template | null> {
        if (stored.name === undefined ||
            stored.coords === undefined ||
            stored.width === undefined ||
            stored.height === undefined ||
            stored.base64Data === undefined ||
            stored.tiles === undefined)
            return null;

        const template = new Template(stored.name, PixelCoords.copy(stored.coords as any), stored.width, stored.height);
        if (stored.enabled !== undefined)
            template.enabled = stored.enabled;

        template.base64Data = stored.base64Data;

        template.tiles = new Map();
        for (const [index, colors] of stored.tiles) {
            const progress = new Map<WplaceColorId, TileProgress>();
            for (const [id, total] of colors) {
                progress.set(id, {
                    total: total,
                    unpainted: total,
                    wrong: 0
                });

                template.totalProgress.total += total;
                template.totalProgress.unpainted += total;
            }
            template.tiles.set(index, progress);
        }

        const message: MessageTemplateFromStorage['message'] = {
            name: 'TemplateFromStorage',
            data: {
                name: template.name,
                width: template.width,
                height: template.height,
                coords: { tx: template.coords.tx, ty: template.coords.ty, px: template.coords.px, py: template.coords.py },
                base64Data: stored.base64Data
            }
        };
        Manager.worker.postMessage(message);

        return template;
    }

    computeBase64Data() {
        const message: MessageComputeBase64Data['message'] = {
            name: 'ComputeBase64Data',
            data: {
                name: this.name
            }
        };
        Manager.worker.postMessage(message);
    }

    overlaps(tile: TileIndex): boolean {
        return this.tiles.has(tile);
    }

    overlapsPixel(pixel: PixelCoords): boolean {
        const ix = (pixel.tx - this.coords.tx) * 1000 - this.coords.px + pixel.px;
        const iy = (pixel.ty - this.coords.ty) * 1000 - this.coords.py + pixel.py;
        return ix >= 0 && ix < this.width && iy >= 0 && iy < this.height;
    }

    async drawOnTile(tile: TileCoords, ctx: OffscreenCanvasRenderingContext2D, trackProgress: boolean): Promise<void> {
        if (!this.enabled || this.imageData === null || !this.overlaps(tile.toIndex()))
            return;

        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const canvasImageData = imageData.data;

        const { promise, resolve, reject } = Promise.withResolvers<MessageDrawOnTile['response']['data']>();
        setTimeout(reject, 10 * 1000);

        const key = this.name + tile.toIndex().toString();
        Manager.workerDrawOnTileResolve.set(key, resolve);

        const message: MessageDrawOnTile['message'] = {
            name: 'DrawOnTile',
            data: {
                name: this.name,
                tile: { x: tile.x, y: tile.y },
                patternSize: Manager.patternSize,
                trackProgress: trackProgress,
                wrongHighlight: Manager.settings.wrongHighlight,
                enabled: Manager.colorsInfo.entries().toArray().map(([id, info]) => [id, info.enabled]),
                canvasWidth: ctx.canvas.width,
                canvas: canvasImageData.buffer
            }
        };
        Manager.worker.postMessage(message, [canvasImageData.buffer]);

        const result = await promise.catch(() => null); // Wait for worker

        Manager.workerDrawOnTileResolve.delete(key);

        if (result === null)
            return;

        ctx.putImageData(new ImageData(new Uint8ClampedArray(result.canvas), ctx.canvas.width, ctx.canvas.height), 0, 0);

        if (trackProgress) {
            this.tiles.set(tile.toIndex(), new Map(result.colorsProgress));
            this.updateTotalProgress();
            updateTemplatePixelCount(this);
        }

        for (const [id, info] of result.colorsInfo) {
            let colorInfo = Manager.colorsInfo.get(id);
            if (colorInfo === undefined) {
                colorInfo = { enabled: true, unpainted: new Set<PixelIndex>(), wrong: new Set<PixelIndex>() };
                Manager.colorsInfo.set(id, colorInfo);
            }

            for (const i of info.unpainted.delete)
                colorInfo.unpainted.delete(i);
            for (const i of info.wrong.delete)
                colorInfo.wrong.delete(i);
            for (const i of info.unpainted.add) {
                if (colorInfo.unpainted.size >= 100)
                    break;
                colorInfo.unpainted.add(i);
            }
            for (const i of info.wrong.add) {
                if (colorInfo.wrong.size >= 100)
                    break;
                colorInfo.wrong.add(i);
            }
        }
    }

    updateTotalProgress() {
        this.totalProgress.total = 0;
        this.totalProgress.unpainted = 0;
        this.totalProgress.wrong = 0;
        for (const colors of this.tiles.values())
            for (const progress of colors.values()) {
                this.totalProgress.total += progress.total;
                this.totalProgress.unpainted += progress.unpainted;
                this.totalProgress.wrong += progress.wrong;
            }
    }

    toJSON(_: string | number): StoredTemplate {
        return {
            name: this.name,
            coords: this.coords,
            width: this.width,
            height: this.height,
            tiles: this.tiles.entries().toArray().map(([index, colors]) => [index, colors.entries().toArray().map(([id, progress]) => [id, progress.total])]),
            enabled: this.enabled,
            base64Data: this.base64Data
        };
    }
}
