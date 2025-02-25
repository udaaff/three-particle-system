import { AudioLoader, Group, Texture, TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

import { AssetType } from './types';

const loaders = {
    texture: new TextureLoader(),
    gltf: new GLTFLoader(),
    audio: new AudioLoader(),
};

// Function to load assets based on their type
export function loadAsset(type: AssetType, path: string): Promise<Texture | Group | AudioBuffer> {
    return new Promise((resolve, reject) => {
        const loader = loaders[type];
        if (!loader) {
            reject(new Error(`No loader for asset type: ${type}`));
            return;
        }
        loader.load(path, resolve as any, undefined, reject);
    });
}
