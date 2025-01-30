import { vec4 } from "gl-matrix";
import { GLTFTexture } from "./GLTFTexture";
import { GLTFTextureFilter, GLTFTextureWrap, ImageUsage } from "./GLTFEnums";
import { GLTFSampler } from "./GLTFSampler";

function createSolidColorTexture(device: GPUDevice, r: number, g: number, b: number, a: number) {
    const data = new Uint8Array([r * 255, g * 255, b * 255, a * 255]);
    const texture = device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    device.queue.writeTexture({ texture }, data, {}, { width: 1, height: 1 });
    return texture;
}

export function loadMaterials(jsonChunk: any, textures: GLTFTexture[]) {
    const materials = [];
    for (const material of jsonChunk.materials) {
        const pbrMaterial = material["pbrMetallicRoughness"];
        const baseColorFactor = pbrMaterial["baseColorFactor"] ?? [1,1,1,1];
        const metallicFactor = pbrMaterial["metallicFactor"] ?? 1;
        const roughnessFactor = pbrMaterial["roughnessFactor"] ?? 1;
       
        
        let baseColorTexture: GLTFTexture | null = null;
        if ("baseColorTexture" in pbrMaterial) {
            baseColorTexture = textures[pbrMaterial["baseColorTexture"]["index"]]
        }

        let metallicRoughnessTexture: GLTFTexture | null = null;
        if ("metallicRoughnessTexture" in pbrMaterial) {
            metallicRoughnessTexture = textures[pbrMaterial["metallicRoughnessTexture"]["index"]];
        }

        let normalTexture: GLTFTexture | null = null;
        if ("normalTexture" in pbrMaterial) {
            normalTexture = textures[pbrMaterial["normalTexture"]["index"]];
        }

       
        materials.push(new GLTFMaterial(baseColorFactor, baseColorTexture, metallicFactor, roughnessFactor, metallicRoughnessTexture, normalTexture));
    }

    return materials;
}

export class GLTFMaterial {
    baseColorFactor: vec4 = [1, 1, 1, 1];
    baseColorTexture: GLTFTexture | null = null;

    metallicFactor: number = 1;
    rougnessFactor: number = 1;
    metallicRoughnessTexture: GLTFTexture | null = null;

    normalTexture: GLTFTexture | null = null;

    paramBuffer: GPUBuffer | null = null;

    bindGroupLayout: GPUBindGroupLayout | null = null;
    bindGroup: GPUBindGroup | null = null;

    constructor(baseColorFactor: vec4, baseColorTexture: GLTFTexture | null, metallicFactor: number, roughnessFactor: number, metallicRoughnessTexture: GLTFTexture | null, normalTexture: GLTFTexture | null) {
        
        this.baseColorFactor = baseColorFactor;
        this.baseColorTexture = baseColorTexture;
        if (this.baseColorTexture) {
            this.baseColorTexture.setUsage(ImageUsage.BASE_COLOR);
        }

        this.metallicFactor = metallicFactor;
        this.rougnessFactor = roughnessFactor;
        this.metallicRoughnessTexture = metallicRoughnessTexture;
        if (this.metallicRoughnessTexture) {
            this.metallicRoughnessTexture.setUsage(ImageUsage.METALLIC_ROUGHNESS);
        }

        this.normalTexture = normalTexture;
        if (this.normalTexture) {
            this.normalTexture.setUsage(ImageUsage.NORMAL);
        }
    }

    upload(device: GPUDevice) {
        this.paramBuffer = device.createBuffer({
            size: 8 * Float32Array.BYTES_PER_ELEMENT, // We'll be passing 6 floats, which round up to 8 in UBO alignment
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            mappedAtCreation: true
        });

        const params = new Float32Array(this.paramBuffer.getMappedRange());
        params.set(this.baseColorFactor, 0);
        params.set([this.metallicFactor, this.rougnessFactor], 4);

        this.paramBuffer.unmap();

        const bindGroupLayoutEntries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }
        ];

        const bindGroupEntries: GPUBindGroupEntry[] = [
            {
                binding: 0,
                resource: {
                    buffer: this.paramBuffer,
                    size: 8 * Float32Array.BYTES_PER_ELEMENT
                }
            }
        ];

        //BASECOLOR

        bindGroupLayoutEntries.push(
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }
        );
        bindGroupLayoutEntries.push(
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {}
            }
        );

        if (this.baseColorTexture) {
            bindGroupEntries.push(
                {
                    binding: 1,
                    resource: this.baseColorTexture.sampler!.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 2,
                    resource: this.baseColorTexture.image!.view!
                }
            );
        } else {
            const opaqueWhiteTexture = createSolidColorTexture(device, 1, 1, 1, 1);
            const defaultSampler = new GLTFSampler(
                GLTFTextureFilter.LINEAR,
                GLTFTextureFilter.LINEAR,
                GLTFTextureWrap.REPEAT,
                GLTFTextureWrap.REPEAT
            );
            defaultSampler.create(device);

            bindGroupEntries.push(
                {
                    binding: 1,
                    resource: defaultSampler.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 2,
                    resource: opaqueWhiteTexture.createView()
                }
            );
        }

        //METALLIC ROUGHNESS
        bindGroupLayoutEntries.push(
            {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }
        );
        bindGroupLayoutEntries.push(
            {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {}
            }
        );

        if (this.metallicRoughnessTexture) {
            bindGroupEntries.push(
                {
                    binding: 3,
                    resource: this.metallicRoughnessTexture.sampler!.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 4,
                    resource: this.metallicRoughnessTexture.image!.view!
                }
            );
        } else {
            const transparentBlackTexture = createSolidColorTexture(device, 0, 0, 0, 0);
            const defaultSampler = new GLTFSampler(
                GLTFTextureFilter.LINEAR,
                GLTFTextureFilter.LINEAR,
                GLTFTextureWrap.REPEAT,
                GLTFTextureWrap.REPEAT
            );
            defaultSampler.create(device);

            bindGroupEntries.push(
                {
                    binding: 3,
                    resource: defaultSampler.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 4,
                    resource: transparentBlackTexture.createView()
                }
            );
        }

        //NORMAL
        bindGroupLayoutEntries.push(
            {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }
        );
        bindGroupLayoutEntries.push(
            {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {}
            }
        );
        if (this.normalTexture) {
            bindGroupEntries.push(
                {
                    binding: 5,
                    resource: this.normalTexture.sampler!.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 6,
                    resource: this.normalTexture.image!.view!
                }
            );
        } else {
            const transparentBlackTexture = createSolidColorTexture(device, 0, 0, 0, 0);
            const defaultSampler = new GLTFSampler(
                GLTFTextureFilter.LINEAR,
                GLTFTextureFilter.LINEAR,
                GLTFTextureWrap.REPEAT,
                GLTFTextureWrap.REPEAT
            );
            defaultSampler.create(device);

            bindGroupEntries.push(
                {
                    binding: 5,
                    resource: defaultSampler.sampler!
                }
            );
            bindGroupEntries.push(
                {
                    binding: 6,
                    resource: transparentBlackTexture.createView()
                }
            );
        }

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: bindGroupLayoutEntries
        });

        this.bindGroup = device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: bindGroupEntries
        });
    }
}