import { PixelCoords } from './Coords';
import { Manager } from './Manager';
import Template from './Template';
import type { UserData, WplaceColorId } from './types';
import { rgbColorMap, rgbToCss } from './utils';

declare function GM_addStyle(css: string): void;

export function injectOverlay() {
    // Inject HTML
    document.body.appendChild(document.createElement('div')).outerHTML = `
%overlay.html%`;

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
        document.getElementById('ca-user-level')!.innerText = nextLevelPixels.toLocaleString();
    }
}

export function addColorRow(template: Template, colorId: WplaceColorId) {
    const c = rgbColorMap.get(colorId)!;

    const row = (document.getElementById('ca-template-color') as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;

    const enable = row.querySelector('input')!;
    enable.checked = true;

    const color = row.querySelector('.ca-color-display') as HTMLDivElement;
    color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;

    //const paint = row.querySelector('button')!;

    row.querySelector('.ca-color-count')!.textContent = template.colorsInfo.get(colorId)!.toString();
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
    Manager.storeTemplates();
}

export function addTemplateRow(template: Template) {
    const outer = document.createElement('div');

    const fly = document.createElement('button');
    fly.innerText = '✈️';
    fly.classList.add('ca-icon-button');

    const middle = document.createElement('div');

    const text = document.createElement('span');
    text.innerText = template.name;

    text.addEventListener('click', e => {
        const s = e.target as HTMLElement;
        if (!s.hasAttribute('contenteditable')) {
            s.setAttribute('contenteditable', '');
            s.focus();
        }
    });
    text.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const s = e.target as HTMLElement;
            s.removeAttribute('contenteditable');
            s.parentElement!.scrollTo(0, 0);
            setNewName(s, template);
        }
    });
    text.addEventListener('blur', e => {
        const s = e.target as HTMLElement;
        s.removeAttribute('contenteditable');
        s.parentElement!.scrollTo(0, 0);
        setNewName(s, template);
    });

    const count = document.createElement('span');
    count.textContent = template.totalPixelCount + ' • ';

    const right = document.createElement('div');

    const enable = document.createElement('input');
    enable.setAttribute('type', 'checkbox');
    enable.checked = template.enabled;

    enable.addEventListener('change', e => {
        template.enabled = (e.target as HTMLInputElement).checked;
        Manager.resetTiles(template.overlappedTiles);
    });

    const del = document.createElement('button');
    del.innerText = '🗑️';
    del.classList.add('ca-icon-button');

    del.addEventListener('click', () => {
        Manager.deleteTemplate(Manager.templates.indexOf(template));
    });

    middle.append(count, text);
    right.append(enable, del);
    outer.append(fly, middle, right);
    document.getElementById('ca-template-list')!.appendChild(outer);
}

export function removeTemplateRow(name: string) {
    for (const div of document.getElementById('ca-template-list')!.children) {
        if (div.children[1]?.textContent === name) {
            div.remove();
            break;
        }
    }
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

export function setInputCoords(coords: PixelCoords) {
    (document.getElementById('ca-input-tx') as HTMLInputElement).value = coords.tx.toString();
    (document.getElementById('ca-input-ty') as HTMLInputElement).value = coords.ty.toString();
    (document.getElementById('ca-input-px') as HTMLInputElement).value = coords.px.toString();
    (document.getElementById('ca-input-py') as HTMLInputElement).value = coords.py.toString();
}
