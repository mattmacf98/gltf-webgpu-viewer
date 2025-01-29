import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFPrimitive, loadPrimitives } from "./GLTFPrimitive";

export function loadMesh(jsonChunk: any, accessors: GLTFAccessor[]) {
    const meshes: GLTFMesh[] = [];
    for (const meshJson of jsonChunk.meshes) {
        const meshPrimitives: GLTFPrimitive[] = loadPrimitives(jsonChunk, meshJson, accessors);

        const mesh = new GLTFMesh(meshJson["name"], meshPrimitives);
        meshes.push(mesh);
    }

    return meshes;
}

export class GLTFMesh {
    name: string;
    primitives: GLTFPrimitive[];

    constructor(name: string, primitives: GLTFPrimitive[]) {
        this.name = name;
        this.primitives = primitives;
    }

    buildRenderPipeline(device: GPUDevice, shaderModule: GPUShaderModule, colorFormat: GPUTextureFormat,
        depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout) {
            for (const primitive of this.primitives) {
                primitive.buildRenderPipeline(device, shaderModule, colorFormat, depthFormat, uniformsBGLayout);
            }

   }

   render(renderPassEncoder: GPURenderPassEncoder, viewParamBindGroup: GPUBindGroup) {
        for (const primitive of this.primitives) {
            primitive.render(renderPassEncoder, viewParamBindGroup);
        }
   }
}