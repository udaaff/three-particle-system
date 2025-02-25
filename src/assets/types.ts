export type AssetType = 'texture' | 'gltf' | 'audio';

export interface AssetsInitOptions {
    manifestPath: string,
    basePath: string,
    backgroundLoad?: boolean,
}

export interface AssetData {
    tags: Record<string, boolean>;
}

export interface Asset {
    alias: string[];
    src: string[];
    type: AssetType;
    data?: AssetData;
}

export interface AssetBundle {
    name: string;
    assets: Asset[];
}

export interface AssetManifest {
    bundles: AssetBundle[];
}
