import { GLTFBufferView } from "./GLTFBufferView";
import { ImageUsage } from "./GLTFEnums";

export async function loadImages(jsonChunk: any, bufferViews: GLTFBufferView[]) {
    const images: GLTFImage[] = [];
    if (!jsonChunk.images) {
        return images;
    }

    for (const image of jsonChunk.images) {
        const bufferView = bufferViews[image["bufferView"]];
        const blob = new Blob([bufferView.view], {type: image["mimeType"]});
        const bitmap = await createImageBitmap(blob);
        images.push(new GLTFImage(bitmap));
    }

    return images;
}

export class GLTFImage {
    bitmap: ImageBitmap;
    usage: ImageUsage = ImageUsage.BASE_COLOR;
    image?: GPUTexture;
    view?: GPUTextureView;

    constructor(bitmap: ImageBitmap) {
        this.bitmap = bitmap;
    }

    setUsage(usage: ImageUsage) {
        this.usage = usage;
    }

    upload(device: GPUDevice) {
        let format: GPUTextureFormat = "rgba8unorm-srgb";
        switch (this.usage) {
            case ImageUsage.BASE_COLOR:
                format = "rgba8unorm-srgb";
                break;
            case ImageUsage.METALLIC_ROUGHNESS:
                format = "rgba8unorm";
                break;
            case ImageUsage.NORMAL:
            case ImageUsage.OCCLUSION:
            case ImageUsage.EMISSION:
                throw new Error("Unhandled image format for now, TODO!");
        }

        const imageSize = [this.bitmap.width, this.bitmap.height, 1];
        this.image = device.createTexture({
            size: imageSize,
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
            {source: this.bitmap},
            {texture: this.image},
            imageSize
        );

        this.view = this.image.createView();
    }
}