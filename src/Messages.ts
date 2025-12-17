import type { PixelCoordsObject, TileCoordsObject } from './Coords';
import type { WplaceColorId, WorkerWplaceColor, TileIndex, TileProgress, PixelIndex } from './types';

type Message<N extends string, M, R = never> = {
    message: {
        name: N,
        data: M;
    };
} & {
    response: [R] extends [never] ? never : {
        name: N,
        data: R;
    };
};


export type MessageInit = Message<
    'Init',
    {
        rgbColorMap: [WplaceColorId, WorkerWplaceColor][];
    }>;
    
export type MessageCreateTemplate = Message<
    'CreateTemplate',
    {
        name: string,
        bitmap: Extract<Transferable, ImageBitmap>,
        coords: PixelCoordsObject;
    },
    {
        name: string,
        tiles: [TileIndex, [WplaceColorId, number][]][];
    }>;

export type MessageTemplateFromStorage = Message<
    'TemplateFromStorage',
    {
        name: string,
        width: number,
        height: number,
        coords: PixelCoordsObject,
        base64Data: string;
    },
    {
        // Send if error
        name: string;
    }>;

export type MessageComputeBase64Data = Message<
    'ComputeBase64Data',
    {
        name: string;
    },
    {
        name: string,
        base64Data: string;
    }>;

export type MessageDrawOnTile = Message<
    'DrawOnTile',
    {
        name: string,
        tile: TileCoordsObject,
        patternSize: number,
        trackProgress: boolean,
        wrongHighlight: boolean,
        enabled: [WplaceColorId, boolean][],
        modifyPixels: PixelIndex[],
        canvasWidth: number,
        canvas: Extract<Transferable, ArrayBuffer>;
    },
    {
        name: string,
        tile: TileCoordsObject,
        colorsProgress: [WplaceColorId, TileProgress][],
        colorsInfo: [WplaceColorId, { unpainted: { add: PixelIndex[], delete: PixelIndex[]; }, wrong: { add: PixelIndex[], delete: PixelIndex[]; }; }][],
        canvas: Extract<Transferable, ArrayBuffer>;
    }>;

type AllMessages = MessageInit | MessageCreateTemplate | MessageTemplateFromStorage | MessageComputeBase64Data | MessageDrawOnTile;
export type WorkerMessage = AllMessages['message'];
export type WorkerResponse = AllMessages['response'];
