import { Coords, FullCoords } from './types';

export function parseCoordsFromPixelURL(url: string): FullCoords {
    const urlSplitted = url.split('/');
    const last = urlSplitted[urlSplitted.length - 1]!;

    return {
        tile: {
            x: parseInt(urlSplitted[urlSplitted.length - 2]!),
            y: parseInt(urlSplitted[urlSplitted.length - 1]!)
        },
        pixel: {
            x: parseInt(last.substring(last.indexOf('?') + 3)),
            y: parseInt(last.substring(last.indexOf('&') + 3))
        }
    };
}

export function parseCoordsFromTileURL(url: string): Coords {
    const urlSplitted = url.split('/');
    return {
        x: parseInt(urlSplitted[urlSplitted.length - 2] ?? ''),
        y: parseInt(urlSplitted[urlSplitted.length - 1] ?? '')
    };
}
