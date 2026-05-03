import { PixelCoords } from './Coords';
import { Manager } from './Manager';
import Template from './Template';
import type { TeleportPixels, TileProgress, UserData, WplaceColorId } from './types';
import { ColorSortingOptions, otherColor, rgbColorMap, rgbToCss, twoDigits } from './utils';

declare function GM_addStyle(css: string): void;

function hehe(s: string | number): string {
    return s.toString().replaceAll('69', '<img class="ca-hehe" src="https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_48b39bc882fd42f6b669d41e4053a36e/default/light/1.0">');
}

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

export async function addAllianceButtonBack() {
    function addButton(node: HTMLElement) {
        const firstButton = node.firstElementChild as HTMLElement;
        if (firstButton === null || firstButton.classList.contains('not-touchscreen:hidden'))
            return;

        const allianceButton = firstButton?.cloneNode(true) as HTMLElement | undefined;
        if (allianceButton === undefined)
            return;

        allianceButton.title = 'Alliance';
        allianceButton.querySelector('svg')!.innerHTML = '<path d="M40-160v-160q0-34 23.5-57t56.5-23h131q20 0 38 10t29 27q29 39 71.5 61t90.5 22q49 0 91.5-22t70.5-61q13-17 30.5-27t36.5-10h131q34 0 57 23t23 57v160H640v-91q-35 25-75.5 38T480-200q-43 0-84-13.5T320-252v92H40Zm440-160q-38 0-72-17.5T351-386q-17-25-42.5-39.5T253-440q22-37 93-58.5T480-520q63 0 134 21.5t93 58.5q-29 0-55 14.5T609-386q-22 32-56 49t-73 17ZM160-440q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T280-560q0 50-34.5 85T160-440Zm640 0q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T920-560q0 50-34.5 85T800-440ZM480-560q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-680q0 50-34.5 85T480-560Z"></path>';

        allianceButton.addEventListener('click', () => {
            (document.getElementsByClassName('flex w-full max-w-full flex-col gap-1.5 overflow-x-clip pr-1')[0]?.children[1] as HTMLElement | undefined)?.click();
        });

        node.insertBefore(allianceButton, firstButton.title === 'Store' ? firstButton.nextElementSibling : firstButton);
    }


    const container = document.getElementsByClassName('absolute top-2 right-2 z-40')[0]?.firstElementChild!;

    const node = container.lastElementChild!;
    if (node.childElementCount !== 5) {
        addButton(node as HTMLElement);
    }
    else
        console.log('AGAGA', container.lastElementChild!.childElementCount);

    const observer = new MutationObserver(mutationList => {
        for (const mutation of mutationList)
            if (mutation.type === "childList")
                for (const node of mutation.addedNodes)
                    if ((node as HTMLElement).classList.contains('flex'))
                        addButton(node as HTMLElement);
    });

    observer.observe(container, { childList: true });
}

function displayFullCharges(): void {
    const ms = Math.max(0, Manager.userFullCharges.getTime() - Date.now());
    const s = ms / 1000;

    let text: string;

    if (s > 3600)
        text = `${twoDigits(Math.floor(s / 3600))}h${twoDigits(Math.floor(s / 60) % 60)}m`;
    else
        text = `${twoDigits(Math.floor(s / 60))}m${twoDigits(Math.floor(s) % 60)}s`;

    document.getElementById('ca-user-charges')!.innerText = text;

    if (s > 3601)
        setTimeout(displayFullCharges, ms % 60000);
    else
        setTimeout(displayFullCharges, ms % 1000);
}

export function displayUserData(data: UserData) {
    // Calculate pixels to the next level
    const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), (1 / 0.65)) - data.pixelsPainted);

    // Calculate full charges time
    Manager.userFullCharges = new Date(Date.now() + (data.charges.max - data.charges.count) * data.charges.cooldownMs);

    const username = document.getElementById('ca-user-name');
    if (username !== null) {
        username.innerText = data.name;
        document.getElementById('ca-user-droplets')!.innerHTML = hehe(data.droplets.toLocaleString());
        document.getElementById('ca-user-level')!.innerHTML = hehe(Math.floor(data.level + 1).toLocaleString());
        document.getElementById('ca-user-pixels')!.innerHTML = hehe(nextLevelPixels.toLocaleString());
        document.getElementById('ca-user-charges')!.setAttribute('data-tip', Manager.userFullCharges.toLocaleString());
        displayFullCharges();
    }
}

export function addColorRow(colorId: WplaceColorId, progress: TileProgress): void {
    const c = rgbColorMap.get(colorId) ?? otherColor;

    const row = (document.getElementById('ca-color-template') as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;

    const div = row.firstElementChild as HTMLDivElement;
    div.id = 'ca-color-id-' + colorId;
    div.style.setProperty('--ca-color-progress', ((progress.total - progress.unpainted - progress.wrong) / progress.total * 100) + '%');
    div.style.setProperty('--ca-color-wrong', ((progress.total - progress.unpainted) / progress.total * 100) + '%');

    const enable = row.querySelector('input')!;
    enable.checked = Manager.enabledColors.get(colorId) === true;
    enable.addEventListener('change', e => {
        Manager.enabledColors.set(colorId, (e.target as HTMLInputElement).checked);
        Manager.refreshTiles();
        Manager.storeGlobal();
    });

    const color = row.querySelector('.ca-color-display') as HTMLDivElement;
    color.style.backgroundColor = `#${rgbToCss(c.rgb)}`;
    color.addEventListener('click', e => {
        [...document.getElementsByClassName('ca-color-row')].forEach(r => (r.firstElementChild as HTMLInputElement).checked = false);
        ((e.target as HTMLDivElement).previousElementSibling! as HTMLInputElement).checked = true;
        Manager.enabledColors.forEach((_, key) => Manager.enabledColors.set(key, key === colorId));
        Manager.refreshTiles();
        Manager.storeGlobal();
    });

    const paint = row.querySelector('button')!;
    if (!Manager.loggedIn)
        paint.style.display = 'none';
    paint.title = 'Double click to teleport to an incorrect pixel';
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
    paint.addEventListener('dblclick', () => {
        const all = Manager.templates
            .filter(t => t.enabled)
            .map(x => x.tiles.values().toArray())
            .flat()
            .map(x => x.get(colorId))
            .filter(x => x !== undefined)
            .reduce((acc: TeleportPixels, curr) => { acc.unpaintedLocations.push(...curr.unpaintedLocations); acc.wrongLocations.push(...curr.wrongLocations); return acc; }, { unpaintedLocations: [], wrongLocations: [] });

        Manager.flyToNextIncorrect(all);
    });

    let countToShow: string | number;
    switch (Manager.settings.colorSorting) {
        case ColorSortingOptions.Total:
            countToShow = progress.total;
            break;
        case ColorSortingOptions.Remaining:
        case ColorSortingOptions.Original:
        case ColorSortingOptions.Luminance:
        case ColorSortingOptions.Hue:
            countToShow = progress.unpainted + progress.wrong;
            break;
        case ColorSortingOptions.Wrong:
            countToShow = progress.wrong;
            break;
        case ColorSortingOptions.Progress:
            countToShow = Math.round((progress.total - progress.unpainted - progress.wrong) / progress.total * 100) + '%';
            break;

        default:
            return Manager.settings.colorSorting satisfies never;
    }

    row.querySelector('.ca-color-count')!.innerHTML = hehe(countToShow);
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

    const fly = row.querySelector('.ca-template-fly') as HTMLButtonElement;
    fly.addEventListener('click', () => {
        Manager.flyToFit(template.coords, template.width, template.height);
    });

    const copy = row.querySelector('.ca-template-copy') as HTMLButtonElement;
    copy.addEventListener('click', async e => {
        const s = `${template.coords.tx} ${template.coords.ty} ${template.coords.px} ${template.coords.py}`;

        await navigator.clipboard.writeText(s);

        // Animation
        const target = e.target as HTMLElement;
        const svg = (target.tagName.toLowerCase() === 'path' ? target.parentElement : target.firstElementChild) as HTMLElement | null;
        if (svg !== null) {
            svg.style.fill = '#2b8f1f';
            setTimeout(() => svg.style.fill = '', 500);
        }
    });

    const teleport = row.querySelector('.ca-teleport-incorrect') as HTMLButtonElement;
    teleport.addEventListener('click', () => {
        const all = template.tiles.values().toArray()
            .map(x => x.values().toArray())
            .flat()
            .reduce((acc: TeleportPixels, curr) => { acc.unpaintedLocations.push(...curr.unpaintedLocations); acc.wrongLocations.push(...curr.wrongLocations); return acc; }, { unpaintedLocations: [], wrongLocations: [] });

        Manager.flyToNextIncorrect(all);
    });

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
            s.scrollTo(0, 0);
            setNewName(s, template);
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            const s = e.target as HTMLSpanElement;
            s.removeAttribute('contenteditable');
            s.scrollTo(0, 0);
            s.textContent = template.name;
        }

        // Prevent Wplace space shortcut
        e.stopPropagation();
        e.stopImmediatePropagation();
    }, { capture: true });
    text.addEventListener('blur', e => {
        const s = e.target as HTMLSpanElement;
        s.removeAttribute('contenteditable');
        s.scrollTo(0, 0);
        setNewName(s, template);
    });
    // Prevent Wplace I and E shortcuts when typing
    text.addEventListener('keypress', e => e.stopPropagation(), { capture: true });

    const enable = row.querySelector('input')!;
    enable.checked = template.enabled;
    enable.addEventListener('change', e => {
        template.enabled = (e.target as HTMLInputElement).checked;
        Manager.deleteTiles(template.tiles.keys());
        Manager.rebuildColorList();
        Manager.storeTemplates();
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
        count.innerHTML = `${hehe(painted)} / ${hehe(template.totalProgress.total)} (${hehe(Math.round(painted / template.totalProgress.total * 1000) / 10)}%)`;

        const wrong = row.querySelector('.ca-wrong-count')!;
        wrong.innerHTML = template.totalProgress.wrong > 0 ? ` • ${hehe(template.totalProgress.wrong)}❌` : '';
    }
}

export function removeTemplateRow(name: string) {
    document.getElementById(`ca-template-id-${name}`)?.remove();
}

export function clickCloseButton() {
    const buttons = document.querySelectorAll('[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"]');
    buttons[buttons.length - 1]?.parentElement?.parentElement?.click();
}

export function displayTileCoords(coords: PixelCoords) {
    const textCoords = `Tile X: ${coords.tx}, Tile Y: ${coords.ty} ; Pixel X: ${coords.px}, Pixel Y: ${coords.py}`;

    const displayCoords = document.getElementsByClassName('ca-display-coords')[0];
    if (displayCoords !== undefined)
        displayCoords.remove();

    const buttonsDiv = document.getElementsByClassName('mt-auto flex w-full justify-between')[0];
    if (buttonsDiv === undefined)
        return;

    const template = (document.getElementById('ca-coords-template') as HTMLTemplateElement).content.cloneNode(true) as DocumentFragment;

    const span = template.querySelector('span')!;
    span.textContent = textCoords;

    const button = template.querySelector('button')!;

    const templateToModify = Manager.templates.findLast(t => t.enabled && t.overlapsPixel(coords));
    const pixelIndex = coords.toIndex();

    if (templateToModify === undefined) {
        button.style.display = 'none';
    }
    else if (templateToModify.modifyPixels.includes(pixelIndex)) {
        button.disabled = true;
    }
    else {
        button.addEventListener('click', () => {
            templateToModify.modifyPixels.push(pixelIndex);
            Manager.refreshTiles(coords.toTileIndex(), true);
            button.disabled = true;
            clickCloseButton();
        });
    }

    buttonsDiv.parentElement?.insertBefore(template, buttonsDiv);
}
