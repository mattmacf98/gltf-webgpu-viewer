import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFMaterial } from "./GLTFMaterial";
import { GLTFPrimitive, loadPrimitives } from "./GLTFPrimitive";
import { Triangle } from "./Triangle";

export function loadMesh(jsonChunk: any, accessors: GLTFAccessor[], materials: GLTFMaterial[]) {
    const meshes: GLTFMesh[] = [];
    for (const meshJson of jsonChunk.meshes) {
        const meshPrimitives: GLTFPrimitive[] = loadPrimitives(jsonChunk, meshJson, accessors, materials);

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
        depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout, nodeParamsBindGroupLayout: GPUBindGroupLayout) {
            for (const primitive of this.primitives) {
                primitive.buildRenderPipeline(device, shaderModule, colorFormat, depthFormat, uniformsBGLayout, nodeParamsBindGroupLayout);
            }

   }

   render(renderPassEncoder: GPURenderPassEncoder) {
        for (const primitive of this.primitives) {
            primitive.render(renderPassEncoder);
        }
   }

   get triangles(): Triangle[] {
    return this.primitives.flatMap(primitive => primitive.triangles);
   }

   get materials(): GLTFMaterial[] {
    return this.primitives.flatMap(primitive => primitive.material);
   }
}