import { PixelCoords } from './Coords';
import { displayStatus, setPixelCoords } from './display';
import { Manager } from './Manager';


export function addListeners() {
    document.getElementById('ca-coords-button')!.addEventListener('click', () => {
        if (Manager.lastClickedCoords === null) {
            displayStatus('Click on the canvas first to pick coordinates');
            return;
        }

        setPixelCoords(Manager.lastClickedCoords);

        Manager.inputCoords = Manager.lastClickedCoords;
    });

    document.getElementById('ca-select-button')!.addEventListener('click', () => {
        document.getElementById('ca-file-input')!.click();
    });

    document.getElementById('ca-file-input')!.addEventListener('change', e => {
        if ((e.target as HTMLInputElement).files!.length > 0)
            document.getElementById('ca-select-button')!.innerText = (e.target as HTMLInputElement).files![0]!.name;
    });

    document.getElementById('ca-create-button')!.addEventListener('click', () => {
        const fileInput = document.getElementById('ca-file-input') as HTMLInputElement;
        if (fileInput.files!.length < 1) {
            displayStatus('Select a file to upload');
            return;
        }

        const tx = parseInt((document.getElementById('ca-input-tx') as HTMLInputElement).value);
        const ty = parseInt((document.getElementById('ca-input-ty') as HTMLInputElement).value);
        const px = parseInt((document.getElementById('ca-input-px') as HTMLInputElement).value);
        const py = parseInt((document.getElementById('ca-input-py') as HTMLInputElement).value);

        if (isNaN(tx) || isNaN(ty) || isNaN(px) || isNaN(py)) {
            displayStatus('Invalid coordonates');
            return;
        }

        const coords = new PixelCoords(tx, ty, px, py);

        Manager.createTemplate(coords, fileInput.files![0]!);
        displayStatus('Created template at ' + coords.toString());
    });
};
