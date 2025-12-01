import { PixelCoords } from './Coords';
import { displayStatus } from './display';
import { Manager } from './Manager';


export function addListeners() {
    document.getElementById('ca-image-collapse')!.addEventListener('click', () => {
        document.getElementById('ca-overlay')!.classList.toggle('collapsed');
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

    document.getElementById('ca-select-button')!.addEventListener('click', () => {
        document.getElementById('ca-file-input')!.click();
    });

    document.getElementById('ca-file-input')!.addEventListener('change', e => {
        if ((e.target as HTMLInputElement).files!.length > 0)
            document.getElementById('ca-select-button')!.innerText = (e.target as HTMLInputElement).files![0]!.name;
    });

    document.getElementById('ca-create-button')!.addEventListener('click', e => {
        (e.target as HTMLInputElement).disabled = true;
        const fileInput = document.getElementById('ca-file-input') as HTMLInputElement;
        if (fileInput.files!.length < 1) {
            displayStatus('Select a file to upload');
            return;
        }

        const coords = Manager.getInputCoords();
        if (coords === null) {
            displayStatus('Invalid coordonates');
            return;
        }

        Manager.createTemplate(coords, fileInput.files![0]!);
        (e.target as HTMLInputElement).disabled = false;
    });

    document.getElementById('ca-converter-button')!.addEventListener('click', () => {
        window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer');
    });
};
