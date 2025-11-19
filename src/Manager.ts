import Template from './Template';
import { FullCoords } from './types';

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
}

export const Manager = new ManagerClass();
