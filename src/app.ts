import { displayStatus, displayUserData, importFont, injectOverlay } from './display';
import { ScriptGetInfo, UserData } from './types';

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

    return response;
};
