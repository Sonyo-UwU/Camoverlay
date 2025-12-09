import { PixelCoords } from './Coords';
import { Manager } from './Manager';
import Template from './Template';
import type { TileProgress, UserData, WplaceColorId } from './types';
import { ColorSortingOptions, otherColor, rgbColorMap, rgbToCss } from './utils';

declare function GM_addStyle(css: string): void;

export function injectOverlay() {
    // Inject HTML
    document.body.appendChild(document.createElement('div')).outerHTML = `
%overlay.html%`.replace(/>\s*</g, '><');

    // Inject CSS
    GM_addStyle(`
%overlay.css%`);
};

export function importFont() {
    // Imports the Roboto Mono font family
    const stylesheetLink = document.createElement('link');
    stylesheetLink.href = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap';
    stylesheetLink.rel = 'stylesheet';
    stylesheetLink.as = 'style';
    document.head.appendChild(stylesheetLink);
}

export function displayStatus(message: string) {
    const textArea = document.getElementById('ca-output') as HTMLTextAreaElement | null;
    if (textArea !== null)
        textArea.value = message;
}

export function displayUserData(data: UserData) {
    // Calculates pixels to the next level
    const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), (1 / 0.65)) - data.pixelsPainted);

    const username = document.getElementById('ca-user-name');
    if (username !== null) {
        username.innerText = data.name;
        document.getElementById('ca-user-droplets')!.innerText = data.droplets.toLocaleString();
        document.getElementById('ca-user-level')!.innerText = Math.floor(data.level + 1).toLocaleString();
        document.getElementById('ca-user-pixels')!.innerText = nextLevelPixels.toLocaleString();
    }
}

export function addColorRow(colorId: WplaceColorId, progress: TileProgress, enabled: boolean): void {
    const c = rgbColorMap.get(colorId) ?? otherColor;

    const row = (document.getElementById('ca-color-template') as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;

    const div = row.firstElementChild as HTMLDivElement;
    div.id = 'ca-color-id-' + colorId;
    div.style.setProperty('--ca-color-progress', ((progress.total - progress.unpainted - progress.wrong) / progress.total * 100) + '%');
    div.style.setProperty('--ca-color-wrong', ((progress.total - progress.unpainted) / progress.total * 100) + '%');

    const enable = row.querySelector('input')!;
    enable.checked = enabled;
    Manager.enabledColors.set(colorId, enabled);
    enable.addEventListener('change', e => {
        Manager.enabledColors.set(colorId, (e.target as HTMLInputElement).checked);
        Manager.tilesInfo.clear();
        Manager.storeGlobal();
    });

    const color = row.querySelector('.ca-color-display') as HTMLDivElement;
    color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;
    color.addEventListener('click', e => {
        [...document.getElementsByClassName('ca-color-row')].forEach(r => (r.firstElementChild as HTMLInputElement).checked = false);
        ((e.target as HTMLDivElement).previousElementSibling! as HTMLInputElement).checked = true;
        Manager.enabledColors.forEach((_, key) => Manager.enabledColors.set(key, key === colorId));
        Manager.tilesInfo.clear();
        Manager.storeGlobal();
    });

    const paint = row.querySelector('button')!;
    paint.addEventListener('click', () => {
        (document.getElementsByClassName('btn btn-primary btn-lg sm:btn-xl relative z-30')[0] as HTMLElement | undefined)?.click();
        setTimeout(() => {
            const container = document.getElementsByClassName('mb-4 mt-3')[0]!.firstElementChild!;
            for (const div of container.children) {
                const button = div.firstElementChild as HTMLElement;
                const colorName = div.getAttribute('data-tip');
                if (colorName === c.name) {
                    button.click();
                    return;
                }
            }
        });
    });

    switch (Manager.colorSorting) {
        case ColorSortingOptions.Total:
            row.querySelector('.ca-color-count')!.textContent = progress.total.toString();
            break;
        case ColorSortingOptions.Remaining:
            row.querySelector('.ca-color-count')!.textContent = (progress.unpainted + progress.wrong).toString();
            break;
        case ColorSortingOptions.Wrong:
            row.querySelector('.ca-color-count')!.textContent = (progress.wrong).toString();
            break;

        default:
            const n: never = Manager.colorSorting;
            n;
            break;
    }
    row.querySelector('.ca-color-name')!.textContent = c.name;

    document.getElementById('ca-color-list')!.appendChild(row);
}

function setNewName(s: HTMLElement, template: Template) {
    const newName = s.textContent.replaceAll('\n', '');
    if (newName.length === 0 || Manager.templates.some(t => t.name === newName)) {
        s.textContent = template.name;
        return;
    }

    template.name = newName;
    s.closest('.ca-template-row')!.id = `ca-template-id-${newName}`;
    Manager.storeTemplates();
}

export function addTemplateRow(template: Template) {
    const row = (document.getElementById('ca-template-template') as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;

    row.firstElementChild!.id = `ca-template-id-${template.name}`;

    //const fly = row.querySelector('.ca-template-fly') as HTMLButtonElement;

    const text = row.querySelector('.ca-template-name') as HTMLSpanElement;
    text.textContent = template.name;
    text.addEventListener('click', e => {
        const s = e.target as HTMLSpanElement;
        if (!s.hasAttribute('contenteditable')) {
            s.setAttribute('contenteditable', '');
            s.focus();
        }
    });
    text.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const s = e.target as HTMLSpanElement;
            s.removeAttribute('contenteditable');
            s.parentElement!.scrollTo(0, 0);
            setNewName(s, template);
        }
    });
    text.addEventListener('blur', e => {
        const s = e.target as HTMLSpanElement;
        s.removeAttribute('contenteditable');
        s.parentElement!.scrollTo(0, 0);
        setNewName(s, template);
    });

    const enable = row.querySelector('input')!;
    enable.checked = template.enabled;
    enable.addEventListener('change', e => {
        template.enabled = (e.target as HTMLInputElement).checked;
        Manager.resetTiles(template.tiles.keys());
        Manager.rebuildColorList();
    });

    const del = row.querySelector('.ca-template-delete') as HTMLButtonElement;
    del.addEventListener('click', () => {
        Manager.deleteTemplate(Manager.templates.indexOf(template));
    });

    document.getElementById('ca-template-list')!.appendChild(row);
    updateTemplatePixelCount(template);
}

export function updateTemplatePixelCount(template: Template) {
    const row = document.getElementById(`ca-template-id-${template.name}`);
    if (row) {
        const count = row.querySelector('.ca-pixel-count')!;
        const painted = template.totalProgress.total - template.totalProgress.unpainted - template.totalProgress.wrong;
        count.textContent = `${painted} / ${template.totalProgress.total} (${Math.round(painted / template.totalProgress.total * 1000) / 10}%)`;

        const wrong = row.querySelector('.ca-wrong-count')!;
        wrong.textContent = template.totalProgress.wrong > 0 ? ` • ${template.totalProgress.wrong}❌` : '';
    }
}

export function removeTemplateRow(name: string) {
    document.getElementById(`ca-template-id-${name}`)?.remove();
}

export function displayTileCoords(coords: PixelCoords) {
    const textCoords = `Tile X: ${coords.tx}, Tile Y: ${coords.ty} ; Pixel X: ${coords.px}, Pixel Y: ${coords.py}`;

    const displayCoords = document.getElementById('ca-display-coords');
    if (displayCoords !== null) {
        displayCoords.textContent = textCoords;
    }
    else {
        const div = document.getElementsByClassName('text-base-content/80 mt-1 px-3 text-sm')[0];
        if (div !== undefined) {
            const span = document.createElement('span');
            span.id = 'ca-display-coords';
            span.textContent = textCoords;
            span.style.paddingInline = 'calc(var(--spacing)*3)';
            span.style.fontSize = 'small';
            div.insertAdjacentElement('beforebegin', span);
        }
    }
}
