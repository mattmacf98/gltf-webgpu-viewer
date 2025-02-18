import { GLTFMaterial } from "./GLTFMaterial";
import { GLTFNode } from "./GLTFNode";
import { Triangle } from "./Triangle";

export class GLTFScene {
    nodes: GLTFNode[];
    constructor(nodes: GLTFNode[]) {
        this.nodes = nodes;
    }

    buildRenderPipeline(device: GPUDevice, shaderModule: GPUShaderModule, colorFormat: GPUTextureFormat,
        depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout) {
            for (const node of this.nodes) {
                node.buildRenderPipeline(device, shaderModule, colorFormat, depthFormat, uniformsBGLayout);
            }

    }

    render(renderPassEncoder: GPURenderPassEncoder, uniformsBG: GPUBindGroup) {
        renderPassEncoder.setBindGroup(0, uniformsBG);
        for (const node of this.nodes) {
            node.render(renderPassEncoder);
        }
    }

    get triangles(): Triangle[] {
        return this.nodes.flatMap(node => node.triangles);
    }

    get materials(): GLTFMaterial[] {
        return this.nodes.flatMap(node => node.materials);
    }
}