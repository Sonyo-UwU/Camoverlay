import { displayStatus, displayTileCoords, displayUserData, importFont, injectOverlay } from './display';
import { addListeners } from './eventListeners';
import { Manager } from './Manager';
import type { ScriptGetInfo, UserData } from './types';
import { parsePixelCoordsFromURL, parseTileCoordsFromURL } from './utils';

declare const GM_info: ScriptGetInfo;
declare const unsafeWindow: typeof window;

declare global {
    /**
     * Randomize array in-place using Durstenfeld shuffle algorithm and returns the reference to the array.
     */
    interface Array<T> {
        shuffle(): Array<T>;
    }
}
Array.prototype.shuffle = function <T>(this: Array<T>) {
    for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = this[i]!;
        this[i] = this[j]!;
        this[j] = temp;
    }

    return this;
}

await Manager.createWorker();

Manager.getMapObject();

importFont();
injectOverlay();
addListeners();

Manager.loadGlobals();
await Manager.loadTemplates();

// Display version
document.getElementById('ca-version')!.innerText = 'version ' + GM_info.script.version;

// Override fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function (input: Parameters<typeof window.fetch>[0], init?: Parameters<typeof window.fetch>[1]): ReturnType<typeof window.fetch> {
    const url = input instanceof Request ? input.url : input as string;
    const method = init?.method ?? 'GET';

    const response = await originalFetch(input, init);

    const contentType = response.headers.get('content-type') ?? '';

    // Me
    if (contentType.includes('application/json') && url.endsWith('/me') && method === 'GET') {
        const json = await response.clone().json() as UserData;
        if (json.status && json.status.toString()[0] !== '2') {
            // Not logged in / server down
            displayStatus('Could not fetch user data, are you logged in?');
            document.querySelectorAll('.ca-color-row button').forEach(b => (b as HTMLButtonElement).style.display = 'none');
            Manager.loggedIn = false;
        }
        else {
            displayUserData(json);
            document.querySelectorAll('.ca-color-row button').forEach(b => (b as HTMLButtonElement).style.display = '');
            Manager.loggedIn = true;
        }
    }

    else if (contentType.includes('application/json') && url.includes('/pixel/')) {
        // Pixel
        if (method === 'GET') {
            const coords = parsePixelCoordsFromURL(url);

            Manager.lastClickedCoords = coords;
            displayTileCoords(coords);
        }

        // Painted
        else if (method === 'POST') {
            const coords = parseTileCoordsFromURL(url);
            Manager.tilesInfo.delete(coords.toIndex());
        }
    }

    // Tiles
    else if (contentType.includes('image/') && url.includes('/tiles/') && method === 'GET') {
        const coords = parseTileCoordsFromURL(url);

        const start = performance.now();
        const modified = await Manager.processTile(coords, response);
        const time = performance.now() - start;
        console.log('Processed tile' + coords.toString() + ' in ' + time + 'ms');

        return modified;
    }


    return response;
};

(unsafeWindow as any).Manager = Manager;
