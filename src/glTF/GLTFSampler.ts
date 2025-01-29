import { GLTFTextureFilter, GLTFTextureWrap } from "./GLTFEnums";

function gltfTextureFilterMode(filter: GLTFTextureFilter) {
    switch (filter) {
        case GLTFTextureFilter.NEAREST_MIPMAP_NEAREST:
        case GLTFTextureFilter.NEAREST_MIPMAP_LINEAR:
        case GLTFTextureFilter.NEAREST:
        return "nearest" as GPUFilterMode;
        case GLTFTextureFilter.LINEAR_MIPMAP_NEAREST:
        case GLTFTextureFilter.LINEAR_MIPMAP_LINEAR:
        case GLTFTextureFilter.LINEAR:
        return "linear" as GPUFilterMode;
    }
}
function gltfAddressMode(mode: GLTFTextureWrap) {
    switch (mode) {
        case GLTFTextureWrap.REPEAT:
        return "repeat" as GPUAddressMode;
        case GLTFTextureWrap.CLAMP_TO_EDGE:
        return "clamp-to-edge" as GPUAddressMode;
        case GLTFTextureWrap.MIRRORED_REPEAT:
        return "mirror-repeat" as GPUAddressMode;
    }
}

export function loadSamplers(jsonChunk: any) {
    const samplers: GLTFSampler[] = [];
    if (!jsonChunk.samplers) {
        return [];
    }

    for (const sampler of jsonChunk.samplers) {
        samplers.push(new GLTFSampler(sampler["magFilter"] as GLTFTextureFilter, sampler["minFilter"] as GLTFTextureFilter,
             sampler["wrapS"] as GLTFTextureWrap, sampler["wrapT"] as GLTFTextureWrap));
    }
    return samplers;
}

export class GLTFSampler {
    magFilter: GPUFilterMode;
    minFilter: GPUFilterMode;
    wrapU: GPUAddressMode;
    wrapV: GPUAddressMode;
    sampler?: GPUSampler;

    constructor(magFilter: GLTFTextureFilter, minFilter: GLTFTextureFilter, wrapU: GLTFTextureWrap, wrapV: GLTFTextureWrap) {
        this.magFilter = gltfTextureFilterMode(magFilter);
        this.minFilter = gltfTextureFilterMode(minFilter);
        this.wrapU = gltfAddressMode(wrapU);
        this.wrapV = gltfAddressMode(wrapV);
    }

    create(device: GPUDevice) {
        this.sampler = device.createSampler({
            magFilter: this.magFilter,
            minFilter: this.minFilter,
            addressModeU: this.wrapU,
            addressModeV: this.wrapV,
            mipmapFilter: "nearest"
        })
    }
}