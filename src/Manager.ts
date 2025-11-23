import { PixelCoords, TileCoords } from './Coords';
import Template from './Template';
import { TileIndex, TileInfo } from './types';

class ManagerClass {
    lastClickedCoords: PixelCoords | null = null;
    templates: Template[];
    tilesInfo: Map<TileIndex, TileInfo>;

    constructor() {
        this.templates = [];
        this.tilesInfo = new Map();
    }

    async createTemplate(coords: PixelCoords, file: File): Promise<Template> {
        const bitmap = await createImageBitmap(file);

        const template = new Template(file.name, coords, bitmap);
        this.templates.push(template);
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
        const canvas = new OffscreenCanvas(1000, 1000);
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
