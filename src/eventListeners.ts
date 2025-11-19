import { displayStatus } from './display';
import { Manager } from './Manager';


export function addListeners() {
    document.getElementById('ca-coords-button')!.addEventListener('click', () => {
        if (Manager.lastClickedCoords === null) {
            displayStatus('Click on the canvas first to pick coordinates');
            return;
        }

        (document.getElementById('ca-input-tx') as HTMLInputElement).value = Manager.lastClickedCoords.tile.x.toString();
        (document.getElementById('ca-input-ty') as HTMLInputElement).value = Manager.lastClickedCoords.tile.y.toString();
        (document.getElementById('ca-input-px') as HTMLInputElement).value = Manager.lastClickedCoords.pixel.x.toString();
        (document.getElementById('ca-input-py') as HTMLInputElement).value = Manager.lastClickedCoords.pixel.y.toString();
    });

    document.getElementById('ca-select-button')!.addEventListener('click', () => {
        document.getElementById('ca-file-input')!.click();
    });

    document.getElementById('ca-create-button')!.addEventListener('click', () => {
        const fileInput = document.getElementById('ca-file-input') as HTMLInputElement;
        if (fileInput.files!.length < 1) {
            displayStatus('Select a file to upload');
            return;
        }

        Manager.createTemplate(fileInput.files![0]!);
    });
};
