import { PixelCoords } from './Coords';
import { displayStatus } from './display';
import { Manager } from './Manager';
import { ColorSortingOptions, getColor } from './utils';


export function addListeners() {
    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.altKey)
            return;

        switch (e.key) {
            case 'v':
                document.getElementById('ca-enable-selected')!.click();
                break;
            case 'a':
                document.getElementById('ca-enable-all')!.click();
                break;
            case 'd':
                document.getElementById('ca-disable-all')!.click();
                break;
            case 'n':
                if (!Manager.loggedIn)
                    break;

                const colorList = document.getElementById('ca-color-list')!;
                for (let i = 0; i < colorList.childElementCount; i++) {
                    if ((colorList.children[i]!.firstElementChild as HTMLInputElement).checked) {
                        const nextRow = colorList.children[i + 1];
                        if (nextRow === undefined)
                            break;

                        (nextRow.children[1] as HTMLElement).click();
                        (nextRow.children[2] as HTMLElement).click();
                        nextRow.scrollIntoView({ 'behavior': 'smooth', 'block': 'center' });
                        break;
                    }
                }
                break;
            case 'N':
                if (!Manager.loggedIn)
                    break;

                const colorListR = document.getElementById('ca-color-list')!;
                for (let i = 0; i < colorListR.childElementCount; i++) {
                    if ((colorListR.children[i]!.firstElementChild as HTMLInputElement).checked) {
                        const nextRow = colorListR.children[i - 1];
                        if (nextRow === undefined)
                            break;

                        (nextRow.children[1] as HTMLElement).click();
                        (nextRow.children[2] as HTMLElement).click();
                        nextRow.scrollIntoView({ 'behavior': 'smooth', 'block': 'center' });
                        break;
                    }
                }
                break;
            case 'i':
                if (Manager.loggedIn)
                    (document.getElementsByClassName('btn btn-primary btn-lg sm:btn-xl relative z-30')[0] as HTMLElement | undefined)?.click();
                break;
            case 'Escape':
                const buttons = document.querySelectorAll('[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"]');
                buttons[buttons.length - 1]?.parentElement?.parentElement?.click();
                break;
        }
    });


    document.getElementById('ca-image-collapse')!.addEventListener('click', () => {
        const overlay = document.getElementById('ca-overlay')!;
        if (overlay.classList.contains('collapsed')) {
            overlay.classList.remove('collapsed');
            setTimeout(() => {
                overlay.style.overflow = '';
            }, 500);
        }
        else {
            overlay.style.overflow = 'hidden';
            overlay.classList.add('collapsed');
        }
    });

    document.getElementById('ca-fly-hq')!.addEventListener('click', () => {
        Manager.flyToFit(new PixelCoords(1054, 713, 337, 494), 2269, 1537, 1);
    });

    function pasted(e: ClipboardEvent) {
        const values = e.clipboardData?.getData('text').split(" ").filter(n => n).map(Number).filter(n => !isNaN(n));
        if (values === undefined || values.length !== 4)
            return;

        e.preventDefault();
        Manager.setInputCoords(new PixelCoords(values[0]!, values[1]!, values[2]!, values[3]!));
    }

    document.getElementById('ca-input-tx')!.addEventListener('paste', pasted);
    document.getElementById('ca-input-ty')!.addEventListener('paste', pasted);
    document.getElementById('ca-input-px')!.addEventListener('paste', pasted);
    document.getElementById('ca-input-py')!.addEventListener('paste', pasted);

    document.getElementById('ca-coords-button')!.addEventListener('click', () => {
        if (Manager.lastClickedCoords === null) {
            displayStatus('Click on the canvas first to pick coordinates');
            return;
        }

        Manager.setInputCoords(Manager.lastClickedCoords);
    });

    document.getElementById('ca-copy-coords-button')!.addEventListener('click', async () => {
        const coords = Manager.getInputCoords();
        if (coords === null)
            return;

        const s = `${coords.tx} ${coords.ty} ${coords.px} ${coords.py}`;

        await navigator.clipboard.writeText(s);

        // Animation
        const svg = document.getElementById('ca-copy-coords-button')?.firstElementChild as HTMLElement | undefined;
        if (svg !== undefined) {
            svg.style.fill = '#2b8f1f';
            setTimeout(() => svg.style.fill = '', 500);
        }
    });

    document.getElementById('ca-setting-ui-size')!.addEventListener('change', e => {
        Manager.settings.uiSize = (e.target as HTMLInputElement).value;
        Manager.storeGlobal();

        const overlay = document.getElementById('ca-overlay') as HTMLDivElement;
        overlay.style.transition = 'none';
        overlay.style.setProperty('--ca-ui-size', Manager.settings.uiSize + '%');
        setTimeout(() => (document.getElementById('ca-overlay') as HTMLDivElement).style.transition = '', 100);
    });

    document.getElementById('ca-setting-hide-completed')!.addEventListener('change', e => {
        Manager.settings.hideCompleted = (e.target as HTMLInputElement).checked;
        Manager.storeGlobal();
        Manager.rebuildColorList();
    });

    document.getElementById('ca-sort-select')!.addEventListener('change', e => {
        Manager.settings.colorSorting = (e.target as HTMLSelectElement).value as ColorSortingOptions;
        Manager.storeGlobal();
        Manager.rebuildColorList();
    });

    document.getElementById('ca-sort-reverse')!.addEventListener('click', () => {
        Manager.settings.colorSortingReversed = !Manager.settings.colorSortingReversed;
        Manager.storeGlobal();
        Manager.rebuildColorList();
    });

    document.getElementById('ca-enable-all')!.addEventListener('click', () => {
        Manager.enabledColors.keys().forEach(id => {
            Manager.enabledColors.set(id, true);
            const checkbox = document.getElementById('ca-color-id-' + id)?.firstElementChild as HTMLInputElement | undefined;
            if (checkbox !== undefined)
                checkbox.checked = true;
        });

        Manager.refreshTiles();
        Manager.storeGlobal();
    });
    document.getElementById('ca-disable-all')!.addEventListener('click', () => {
        Manager.enabledColors.keys().forEach(id => {
            Manager.enabledColors.set(id, false);
            const checkbox = document.getElementById('ca-color-id-' + id)?.firstElementChild as HTMLInputElement | undefined;
            if (checkbox !== undefined)
                checkbox.checked = false;
        });

        Manager.refreshTiles();
        Manager.storeGlobal();
    });

    document.getElementById('ca-enable-selected')!.addEventListener('click', () => {
        const background = (document.getElementsByClassName('mb-4 mt-3')[0]?.getElementsByClassName('border-primary')[0] as HTMLElement | undefined)?.style.background;
        if (background === undefined) {
            displayStatus(`No color selected`);
            return;
        }

        let rgb = background.slice(4, -1).split(', ').map(Number);

        // Transparent is selected
        if (rgb.length !== 3)
            rgb = [222, 250, 206];

        const color = getColor(rgb[0]!, rgb[1]!, rgb[2]!);

        let inPalette = false;

        // Update palette
        Manager.enabledColors.keys().forEach(id => {
            const checkbox = document.getElementById('ca-color-id-' + id)?.firstElementChild as HTMLInputElement | undefined;

            if (id === color.id) {
                inPalette = true;
                Manager.enabledColors.set(id, true);
                if (checkbox !== undefined) {
                    checkbox.checked = true;
                    checkbox.scrollIntoView({ 'behavior': 'smooth', 'block': 'center' });
                }
                else {
                    displayStatus('Selected color is already completed');
                }
            }
            else {
                Manager.enabledColors.set(id, false);
                if (checkbox !== undefined)
                    checkbox.checked = false;
            }
        });

        if (!inPalette)
            displayStatus(`${color.name} is not in palette`);

        Manager.refreshTiles();
        Manager.storeGlobal();
    });

    document.getElementById('ca-select-button')!.addEventListener('click', () => {
        document.getElementById('ca-file-input')!.click();
    });
    document.getElementById('ca-select-button')!.addEventListener('contextmenu', e => {
        document.getElementById('ca-select-button')!.textContent = 'Select file';
        (document.getElementById('ca-file-input') as HTMLInputElement).value = '';
        e.preventDefault();
    });

    document.getElementById('ca-file-input')!.addEventListener('change', e => {
        if ((e.target as HTMLInputElement).files!.length > 0)
            document.getElementById('ca-select-button')!.innerText = (e.target as HTMLInputElement).files![0]!.name;
    });

    document.getElementById('ca-create-button')!.addEventListener('click', async e => {
        const fileInput = document.getElementById('ca-file-input') as HTMLInputElement;
        if (fileInput.files!.length < 1) {
            displayStatus('Select a file to upload');
            return;
        }

        const coords = Manager.getInputCoords();
        if (coords === null) {
            displayStatus('Invalid coordinates');
            return;
        }

        (e.target as HTMLInputElement).disabled = true;
        await Manager.createTemplate(coords, fileInput.files![0]!);
        (e.target as HTMLInputElement).disabled = false;
    });

    document.getElementById('ca-converter-button')!.addEventListener('click', () => {
        window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer');
    });
};

export function addCanvasListeners(canvas: HTMLCanvasElement) {
    canvas.addEventListener('auxclick', e => {
        // Pick color with middle click
        if (e.button === 1) {
            if (!Manager.loggedIn)
                return;

            // Click paint button if needed
            (document.getElementsByClassName('btn btn-primary btn-lg sm:btn-xl relative z-30')[0] as HTMLElement | undefined)?.click();

            setTimeout(() => {
                // Press the i key
                const keypressEvent = new KeyboardEvent("keypress", {
                    bubbles: true,
                    cancelable: true,
                    key: 'i',
                    code: 'KeyI'
                });
                document.activeElement!.dispatchEvent(keypressEvent);

                // Click canvas
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    button: 0
                });
                canvas.dispatchEvent(clickEvent);
            });
        }
    });
}
