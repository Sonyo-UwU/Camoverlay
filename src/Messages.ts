import type { PixelCoordsObject } from './Coords';
import type { WplaceColorId, WorkerWplaceColor, TileIndex } from './types';

type Message<N extends string, D1, D2 = never> = {
    message: {
        name: N,
        data: D1;
    };
} & {
    response: [D2] extends [never] ? never : {
        name: N,
        data: D2;
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
        imageData: Extract<Transferable, ArrayBuffer>,
        base64Data: string
    }>;

type AllMessages = MessageInit | MessageCreateTemplate;
export type WorkerMessage = AllMessages['message'];
export type WorkerResponse = AllMessages['response'];
