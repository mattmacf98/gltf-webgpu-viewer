export class CubeMaterial {
    private _texture: GPUTexture;
    private _sampler: GPUSampler;
    private _view: GPUTextureView;

    public get texture(): GPUTexture {
        return this._texture;
    }

    public get sampler(): GPUSampler {
        return this._sampler;
    }

    public get view(): GPUTextureView {
        return this._view;
    }

    private constructor(texture: GPUTexture, sampler: GPUSampler, view: GPUTextureView) {
        this._texture = texture;
        this._sampler = sampler;
        this._view = view;
    }

    static async init(device: GPUDevice, imageUrls: string[]) {
        const imageData: ImageBitmap[] = [];
        for (const url of imageUrls) {
            const response = await fetch(url);
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);
            imageData.push(imageBitmap);
        }
        const texture = CubeMaterial._loadImageBitmaps(device, imageData);

        const viewDescriptor: GPUTextureViewDescriptor = {
            dimension: "cube",
            format: "rgba8unorm",
            aspect: "all",
            baseMipLevel: 0,
            mipLevelCount: 1,
            baseArrayLayer: 0,
            arrayLayerCount: 6
        }
        const view = texture.createView(viewDescriptor);

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear"
        }
        const sampler = device.createSampler(samplerDescriptor);

        return new CubeMaterial(texture, sampler, view);
    }

    private static _loadImageBitmaps(device: GPUDevice, imageData: ImageBitmap[]): GPUTexture {
        const textureDescriptor: GPUTextureDescriptor = {
            size: [imageData[0].width, imageData[0].height, 6],
            dimension: "2d",
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        }

        const texture = device.createTexture(textureDescriptor);

        for (let i = 0; i < 6; i++) {
           device.queue.copyExternalImageToTexture(
            {source: imageData[i]},
            {texture: texture, origin: [0, 0, i]},
            {width: imageData[i].width, height: imageData[i].height}
           );
        }

        return texture;
    }
}