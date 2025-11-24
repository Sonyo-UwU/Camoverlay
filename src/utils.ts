import { PixelCoords, TileCoords } from './Coords';

export function parsePixelCoordsFromURL(url: string): PixelCoords {
    const urlSplitted = url.split('/');
    const last = urlSplitted[urlSplitted.length - 1]!;

    return new PixelCoords(
        parseInt(urlSplitted[urlSplitted.length - 2]!),
        parseInt(urlSplitted[urlSplitted.length - 1]!),
        parseInt(last.substring(last.indexOf('?') + 3)),
        parseInt(last.substring(last.indexOf('&') + 3))
    );
}

export function parseTileCoordsFromURL(url: string): TileCoords {
    const urlSplitted = url.split('/');
    return new TileCoords(
        parseInt(urlSplitted[urlSplitted.length - 2] ?? ''),
        parseInt(urlSplitted[urlSplitted.length - 1] ?? '')
    );
}
