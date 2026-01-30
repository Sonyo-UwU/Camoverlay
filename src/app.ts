import { displayStatus, displayTileCoords, displayUserData, importFont, injectOverlay } from './display';
import { addListeners } from './eventListeners';
import { Manager } from './Manager';
import type { ScriptGetInfo, UserData } from './types';
import { parsePixelCoordsFromURL, parseTileCoordsFromURL } from './utils';

declare const GM_info: ScriptGetInfo;
declare const unsafeWindow: typeof window;

await Manager.createWorker();

Manager.getMapObject();

importFont();
injectOverlay();
addListeners();

Manager.loadGlobals();
await Manager.loadTemplates();

// Display version
document.getElementById('ca-version')!.innerText = 'version ' + GM_info.script.version;

setInterval(() => {
    if (!Manager.loggedIn) {
        // Maybe the first /me request was not intercepted or the server is down, try sending another
        unsafeWindow.fetch('https://backend.wplace.live/me', { credentials: 'include' });
    }
}, 10000);

// Override fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function (input: Parameters<typeof window.fetch>[0], init?: Parameters<typeof window.fetch>[1]): ReturnType<typeof window.fetch> {
    const url = input instanceof Request ? input.url : input as string;
    const method = init?.method ?? 'GET';


    if (url.includes('/tiles/') && method === 'GET') {
        const coords = parseTileCoordsFromURL(url);
        const tileIndex = coords.toIndex();
        const tileInfo = Manager.tilesInfo.get(tileIndex);
        if (tileInfo?.shouldUseOrig && tileInfo.origBlob !== null) {
            // Skip fetch
            const start = performance.now();
            const modified = await Manager.processTileFromOrig(coords);
            const time = performance.now() - start;
            if (time >= 2)
                console.log('Processed tile' + coords.toString() + ' in ' + time + 'ms');

            return modified;
        }
    }

    const response = await originalFetch(input, init);

    const contentType = response.headers.get('content-type') ?? '';

    // Me
    if (contentType.includes('application/json') && url.endsWith('/me') && method === 'GET') {
        const json = await response.clone().json() as UserData;
        if (json.status && json.status.toString()[0] !== '2') {
            // Not logged in / server down
            displayStatus('Could not fetch user data, are you logged in?');
            document.querySelectorAll('.ca-color-row button').forEach(b => (b as HTMLButtonElement).style.display = 'none');
            document.getElementById('ca-user-info')!.style.display = 'none';
            Manager.loggedIn = false;
        }
        else {
            displayUserData(json);
            document.querySelectorAll('.ca-color-row button').forEach(b => (b as HTMLButtonElement).style.display = '');
            document.getElementById('ca-user-info')!.style.display = '';
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
        if (time >= 2)
            console.log('Processed tile' + coords.toString() + ' in ' + time + 'ms');

        return modified;
    }


    return response;
};

(unsafeWindow as any).Manager = Manager;
