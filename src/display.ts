import type { UserData } from './types';

declare function GM_addStyle(css: string): void;

export function injectOverlay() {
    // Inject HTML
    document.body.appendChild(document.createElement('div')).outerHTML = `
%overlay.html%`;

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

export function displayUserData(data: UserData) {
    //console.log(data);

    // Calculates pixels to the next level
    const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), (1 / 0.65)) - data.pixelsPainted);

    const username = document.getElementById('ca-user-name');
    if (username !== null) {
        username.innerText = data.name;
        document.getElementById('ca-user-droplets')!.innerText = data.droplets.toLocaleString();
        document.getElementById('ca-user-level')!.innerText = nextLevelPixels.toLocaleString();
    }
}
