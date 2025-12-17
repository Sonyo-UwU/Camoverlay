import type { PixelCoordsObject } from './Coords';
import type { WplaceColorId, WorkerWplaceColor, TileIndex } from './types';

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
        tiles: [TileIndex, [WplaceColorId, number][]][],
        imageData: Extract<Transferable, ArrayBuffer>;
    }>;

export type MessageTemplateFromStorage = Message<
    'TemplateFromStorage',
    {
        name: string,
        base64Data: string;
    },
    {
        name: string,
        imageData: Extract<Transferable, ArrayBuffer>;
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

type AllMessages = MessageInit | MessageCreateTemplate | MessageComputeBase64Data | MessageTemplateFromStorage;
export type WorkerMessage = AllMessages['message'];
export type WorkerResponse = AllMessages['response'];
