import { displayStatus, displayTileCoords, displayUserData, importFont, injectOverlay } from './display';
import { addListeners } from './eventListeners';
import { Manager } from './Manager';
import type { ScriptGetInfo, UserData } from './types';
import { coordsToString, parseCoordsFromPixelURL, parseCoordsFromTileURL } from './utils';

declare const GM_info: ScriptGetInfo;
declare const unsafeWindow: typeof window;


importFont();
injectOverlay();
addListeners();

// Display version
displayStatus('version ' + GM_info.script.version);

// Override fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function (input: Parameters<typeof window.fetch>[0], init?: Parameters<typeof window.fetch>[1]): ReturnType<typeof window.fetch> {
    const response = await originalFetch(input, init);

    const url = input instanceof Request ? input.url : input as string;
    const contentType = response.headers.get('content-type') ?? '';

    // Me
    if (contentType.includes('application/json') && url.includes('/me')) {
        const json = await response.clone().json() as UserData;
        if (json.status && json.status.toString()[0] !== '2') {
            // Not logged in / server down
            displayStatus('Could not fetch user data, are you logged in?');
        }
        else {
            displayUserData(json);
        }
    }

    // Pixel
    else if (contentType.includes('application/json') && url.includes('/pixel')) {
        const coords = parseCoordsFromPixelURL(url);

        Manager.lastClickedCoords = coords;
        displayTileCoords(coords);
    }

    // Tiles
    else if (contentType.includes('image/') && url.includes('/tiles/')) {
        const coords = parseCoordsFromTileURL(url);

        const start = performance.now();
        const modified = await Manager.processTile(coords, response);
        const time = performance.now() - start;
        console.log('Processed tile' + coordsToString(coords) + ' in ' + time + 'ms');

        return modified;
    }


    return response;
};

(unsafeWindow as any).Manager = Manager;
