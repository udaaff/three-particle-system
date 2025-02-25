import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

import { Asset, AssetBundle, AssetManifest, AssetsInitOptions } from './types';

const assets = new Map<string, any>();
const loadedBundles: string[] = [];
let manifest: AssetManifest;
let basePath: string;

function hasBundle(name: string): boolean {
    return !!manifest.bundles.find(b => b.name === name);
}

async function loadBundle(bundle: AssetBundle): Promise<void> {
    if (loadedBundles.includes(bundle.name))
        return;

    for (const asset of bundle.assets) {
        await loadAsset(asset);
    }

    loadedBundles.push(bundle.name);
}

export async function loadBundles(bundles: string | string[]): Promise<void> {
    if (typeof bundles === "string")
        bundles = [bundles];

    for (const bundleName of bundles) {
        if (!hasBundle(bundleName))
            throw new Error(`Bundle "${bundleName}" does not exist`);
    }

    bundles = bundles.filter(b => !loadedBundles.includes(b));
    if (bundles.length === 0)
        return;

    for (const bundle of manifest.bundles) {
        if (bundles.includes(bundle.name))
            await loadBundle(bundle);
    }
}

export async function loadManifest(manifestPath: string): Promise<AssetManifest> {
    const response = await fetch(`./${basePath}/${manifestPath}`);
    return await response.json();
}

export async function initAssets(params: AssetsInitOptions) {
    basePath = params.basePath;
    manifest = await loadManifest(params.manifestPath);
    if (params?.backgroundLoad ?? true)
        loadBundles(manifest.bundles.map(b => b.name));
}

export function getAsset<T>(name: string): T | undefined {
    return assets.get(name);
}

async function loadAsset(asset: Asset): Promise<void> {
    // Select the first `src` path to determine the asset type (for simplicity)
    const path = `./${basePath}/${asset.src[0]}`;
    const assetType = inferAssetType(path);
    const loader = getLoader(assetType);

    const loadedAsset = await loader.loadAsync(path);

    // Store in `assets` map using each alias as a key
    for (const alias of asset.alias) {
        assets.set(alias, loadedAsset);
    }
}

function inferAssetType(path: string): 'texture' | 'gltf' | 'audio' {
    const extension = path.split('.').pop()?.toLowerCase();

    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
        return 'texture';
    } else if (extension === 'glb' || extension === 'gltf') {
        return 'gltf';
    } else if (extension === 'mp3' || extension === 'wav' || extension === 'ogg') {
        return 'audio';
    } else {
        throw new Error(`Unknown asset type for path: ${path}`);
    }
}

function getLoader(type: 'texture' | 'gltf' | 'audio'): THREE.Loader {
    switch (type) {
        case 'texture':
            return new THREE.TextureLoader();
        case 'gltf':
            return new GLTFLoader();
        case 'audio':
            return new THREE.AudioLoader();
        default:
            throw new Error(`Unsupported asset type: ${type}`);
    }
}