import { displayStatus, displayUserData, importFont, injectOverlay } from './display';
import { Manager } from './Manager';
import type { Coords, ScriptGetInfo, UserData } from './types';

declare const GM_info: ScriptGetInfo;
declare const unsafeWindow: typeof window;


importFont();
injectOverlay();

// Display version
displayStatus('version ' + GM_info.script.version);

// Override fetch
const originalFetch = unsafeWindow.fetch;
unsafeWindow.fetch = async function (input, init?) {
    const response = await originalFetch(input, init);

    const endpoint = input instanceof Request ? input.url : input as string;
    const contentType = response.headers.get('content-type') ?? '';

    // Me
    if (contentType.includes('application/json') && endpoint.includes('/me')) {
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
    else if (contentType.includes('application/json') && endpoint.includes('/pixel')) {
        const endpointSplitted = endpoint.split('/');
        const tilesCoords: Coords = {
            x: parseInt(endpointSplitted[endpointSplitted.length - 2]!),
            y: parseInt(endpointSplitted[endpointSplitted.length - 1]!)
        };

        const last = endpointSplitted[endpointSplitted.length - 1]!;
        const pixelCoords: Coords = {
            x: parseInt(last.substring(last.indexOf('?') + 3)),
            y: parseInt(last.substring(last.indexOf('&') + 3))
        };

        Manager.lastClickedCoords = {
            tile: tilesCoords,
            pixel: pixelCoords
        };

        const textCoords = `Tile X: ${tilesCoords.x}, Tile Y: ${tilesCoords.y} ; Pixel X: ${pixelCoords.x}, Pixel Y: ${pixelCoords.y}`;
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

    // Tiles
    /*
    else if (contentType.includes('image/') && endpoint.includes('/tiles/')) {
        const lastUpdated = new Date(response.headers.get('last-modified') ?? '');

        const blob = await response.blob();

        const endpointSplitted = endpoint.split('/');
        const tilesCoords: Coords = {
            x: parseInt(endpointSplitted[endpointSplitted.length - 2] ?? ''),
            y: parseInt(endpointSplitted[endpointSplitted.length - 1] ?? '')
        };

        console.log(tilesCoords, lastUpdated, blob);

        return new Response(blob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText
        });
    }
    */

    return response;
};
