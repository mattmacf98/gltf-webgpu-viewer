import { GLTFTextureFilter, GLTFTextureWrap, ImageUsage } from "./GLTFEnums";
import { GLTFImage } from "./GLTFImage";
import { GLTFSampler } from "./GLTFSampler";

export function loadTextures(jsonChunk: any, images: GLTFImage[], samplers: GLTFSampler[]) {
    const textures: GLTFTexture[] = [];
    if (!jsonChunk.textures) {
        return textures;
    }

    const defaultSampler = new GLTFSampler(
        GLTFTextureFilter.LINEAR,
        GLTFTextureFilter.LINEAR,
        GLTFTextureWrap.REPEAT,
        GLTFTextureWrap.REPEAT
    );
    let usedDefaultSampler = false;

    for (const texture of jsonChunk.textures) {
        let sampler = null;
        if ("sampler" in texture) {
            sampler = samplers[texture["sampler"]];
        } else {
            sampler = defaultSampler;
            usedDefaultSampler = true;
        }

        textures.push(new GLTFTexture(sampler, images[texture["source"]]));
    }

    if (usedDefaultSampler) {
        samplers.push(defaultSampler);
    }
    return textures;
}

export class GLTFTexture {
    sampler: GLTFSampler;
    image: GLTFImage;

    constructor(sampler: GLTFSampler, image: GLTFImage) {
        this.sampler = sampler;
        this.image = image;
    }

    setUsage(usage: ImageUsage) {
        this.image.setUsage(usage);
    }
}