import { GLTFNode } from "./GLTFNode";

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
}