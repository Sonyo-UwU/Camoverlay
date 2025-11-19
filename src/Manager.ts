import Template from './Template';
import { Coords, FullCoords } from './types';

class ManagerClass {
    templates: Template[];
    lastClickedCoords: FullCoords | null = null;

    constructor() {
        this.templates = [];
    }

    async createTemplate(file: File) {
        const bitmap = await createImageBitmap(file);

        const template = new Template(file.name, bitmap);
        this.templates.push(template);
        return template;
    }

    async processTile(coords: Coords, response: Response) {
        const lastUpdated = new Date(response.headers.get('last-modified') ?? '');

        const blob = await response.blob();

        lastUpdated;
        coords;

        const modifiedBlob = await this.drawOnTile(blob);

        return new Response(modifiedBlob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        });
    }

    async drawOnTile(blob: Blob) {
        const canvas = new OffscreenCanvas(1000, 1000);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(await createImageBitmap(blob), 0, 0);

        for (const template of this.templates) {
            template.drawOnTile(ctx);
        }

        return await canvas.convertToBlob();
    }
}

export const Manager = new ManagerClass();
