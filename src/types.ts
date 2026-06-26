import { ColorSortingOptions } from './utils';

export type TileIndex = number & { readonly b: unique symbol; };
export type PixelIndex = number & { readonly b: unique symbol; };

export type TileInfo = {
    lastModified: EpochTimeStamp;
    shouldUseOrig: 0 | 1 | 2;
    origBlob: Blob | null;
    fullBlob: Blob | null;
};

export type TeleportPixels = {
    wrongLocations: PixelIndex[];
    unpaintedLocations: PixelIndex[];
};

export type TileProgress = {
    total: number;
    unpainted: number;
    wrong: number;
};

export type TileProgressLocations = TileProgress & TeleportPixels;

export type UserSettings = {
    colorSorting: ColorSortingOptions;
    colorSortingReversed: boolean;
    discordConnectionPass: string;
    uiSize: string;
    hideCompleted: boolean;
    preferWrongTeleport: boolean;
};

export type WplaceColorId = number & { readonly b: unique symbol; };
export type WplaceColor = {
    internalId: number;
    id: WplaceColorId;
    name: string;
    wplaceOrder: number;
    rgb: [number, number, number];
};
export type WorkerWplaceColor = Pick<WplaceColor, 'id' | 'rgb'>;

type JsonifiedObject<T> = {
    [Key in keyof T as[JsonifiedValue<T[Key]>] extends [never] ? never : Key]?: JsonifiedValue<T[Key]>
};
type JsonifiedArray<T> = T extends [infer Head, ...infer Tail] ? [JsonifiedValue<Head>, ...JsonifiedArray<Tail>] : [];
export type JsonifiedValue<T> = T extends string | number | null | boolean
    ? T
    : T extends { toJSON(key: string | number): infer R; } ? JsonifiedValue<R>
    : T extends undefined | Function ? never
    : T extends [any, ...any] ? JsonifiedArray<T>
    : T extends Array<infer A> ? JsonifiedValue<A>[]
    : T extends object ? JsonifiedObject<T>
    : never;

export type PromiseResolve<T> = (value: T | PromiseLike<T>) => void;

export type UserData = {
    allianceId: number;
    allianceRole: string;
    banned: boolean;
    charges: {
        cooldownMs: number;
        count: number;
        max: number;
    };
    country: string;
    discord: string;
    discordId: string;
    droplets: number;
	equippedBadges: Array<{
		id: number;
		imageUrl: string;
		name: string;
		rarity: string;
	} | null>;
    equippedFlag: number;
    equippedFrameId: number;
    equippedFrameUrl: string;
	aquippedNameCosmetic: null;
    experiments: {
        "2025-09_discord_linking": {
            enabled: boolean;
        };
        "2025-09_pawtect": {
            variant: string;
        };
    };
    extraColorsBitmap: number;
    favoriteLocations: Array<{
        id: number;
        name: string;
        latitude: number;
        longitude: number;
    }>;
    flagsBitmap: string;
    freeFlag: boolean;
    id: number;
    isCustomer: boolean;
    level: number;
    maxFavoriteLocations: number;
    name: string;
    needsPhoneVerification: boolean;
    picture: string;
    pixelsPainted: number;
    showLastPixel: boolean;
    status?: number;
    timeoutUntil: string;
};

export type WplaceMap = {
    flyTo: (e: { center: [number, number]; zoom: number; }, o?: never) => void;
    refreshTiles: (p: string, e?: unknown) => void;
};

export type ScriptGetInfo = {
    container?: { // 5.3+ | Firefox only
        id: string;
        name?: string;
    };
    downloadMode: string;
    isFirstPartyIsolation?: boolean;
    isIncognito: boolean;
    sandboxMode: SandboxMode; // 4.18+
    scriptHandler: string;
    scriptMetaStr: string | null;
    scriptUpdateURL: string | null;
    scriptWillUpdate: boolean;
    userAgentData: UADataValues; // 4.19+
    version?: string;
    script: {
        antifeatures: { [antifeature: string]: { [locale: string]: string; }; };
        author: string | null;
        blockers: string[];
        connects: string[];
        copyright: string | null;
        deleted?: number | undefined;
        description_i18n: { [locale: string]: string; } | null;
        description: string;
        downloadURL: string | null;
        excludes: string[];
        fileURL: string | null;
        grant: string[];
        header: string | null;
        homepage: string | null;
        icon: string | null;
        icon64: string | null;
        includes: string[];
        lastModified: number;
        matches: string[];
        name_i18n: { [locale: string]: string; } | null;
        name: string;
        namespace: string | null;
        position: number;
        resources: Resource[];
        supportURL: string | null;
        system?: boolean | undefined;
        'run-at': string | null;
        'run-in': string[] | null; // 5.3+
        unwrap: boolean | null;
        updateURL: string | null;
        version: string;
        webRequest: WebRequestRule[] | null;
        options: {
            check_for_updates: boolean;
            comment: string | null;
            compatopts_for_requires: boolean;
            compat_wrappedjsobject: boolean;
            compat_metadata: boolean;
            compat_foreach: boolean;
            compat_powerful_this: boolean | null;
            sandbox: string | null;
            noframes: boolean | null;
            unwrap: boolean | null;
            run_at: string | null;
            run_in: string | null; // 5.3+
            override: {
                use_includes: string[];
                orig_includes: string[];
                merge_includes: boolean;
                use_matches: string[];
                orig_matches: string[];
                merge_matches: boolean;
                use_excludes: string[];
                orig_excludes: string[];
                merge_excludes: boolean;
                use_connects: string[];
                orig_connects: string[];
                merge_connects: boolean;
                use_blockers: string[];
                orig_run_at: string | null;
                orig_run_in: string[] | null; // 5.3+
                orig_noframes: boolean | null;
            };
        };
    };
};

type SandboxMode = 'js' | 'raw' | 'dom';

type Resource = {
    name: string;
    url: string;
    error?: string;
    content?: string;
    meta?: string;
};

type WebRequestRule = {
    selector: {
        include?: string | string[];
        match?: string | string[];
        exclude?: string | string[];
    } | string;
    action: string | {
        cancel?: boolean;
        redirect?: {
            url: string;
            from?: string;
            to?: string;
        } | string;
    };
};

type UADataValues = {
    brands?: {
        brand: string;
        version: string;
    }[];
    mobile?: boolean;
    platform?: string;
    architecture?: string;
    bitness?: string;
};