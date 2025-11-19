import Template from './Template';
import { Coords, FullCoords, TileIndex, TileInfo } from './types';
import { coordsToIndex } from './utils';

class ManagerClass {
    lastClickedCoords: FullCoords | null = null;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;

    constructor() {
        this.templates = [];
        this.tilesInfo = new Map();
    }

    async createTemplate(coords: FullCoords, file: File) {
        const bitmap = await createImageBitmap(file);

        const template = new Template(file.name, coords, bitmap);
        this.templates.push(template);
        return template;
    }

    async processTile(coords: Coords, response: Response) {
        const lastUpdated = new Date(response.headers.get('last-modified') ?? 0).getTime();

        const tileIndex = coordsToIndex(coords);

        let tileInfo: TileInfo;
        if (this.tilesInfo.has(tileIndex)) {
            tileInfo = this.tilesInfo.get(tileIndex)!;
            //if (tileInfo.lastUpdated <= lastUpdated)
            //    return response;

            tileInfo.lastUpdated = lastUpdated;
        }
        else {
            tileInfo = {
                lastUpdated: lastUpdated
            };
            this.tilesInfo.set(tileIndex, tileInfo);
        }

        const blob = await response.blob();
        const modifiedBlob = await this.drawOnTile(coords, blob);

        return new Response(modifiedBlob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        });
    }

    async drawOnTile(coords: Coords, blob: Blob) {
        const canvas = new OffscreenCanvas(1000, 1000);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(await createImageBitmap(blob), 0, 0, canvas.width, canvas.height);

        for (const template of this.templates) {
            template.drawOnTile(coords, ctx);
        }

        return await canvas.convertToBlob();
    }
}

export const Manager = new ManagerClass();
