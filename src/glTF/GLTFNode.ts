import { mat4, ReadonlyVec3 } from "gl-matrix";
import { GLTFMesh } from "./GLTFMesh";

function flattenTree(allNodes: any, node: any, parentTransform: mat4): any {
    let flattened = [];
    let transform = readNodeTransform(node);
    if (parentTransform != undefined) {
        mat4.mul(transform, parentTransform, transform);
    }

    const n = {matrix: transform, mesh: node["mesh"], camera: node["camera"]}
    flattened.push(n);

    if (node["children"]) {
        for (const child of node["children"]) {
            flattened.push(...flattenTree(allNodes, allNodes[child], transform))
        }
    }

    return flattened;
}

function readNodeTransform(node: any) {
    if (node["matrix"]) {
        const m = node["matrix"];
        return mat4.fromValues(m[0] as number,
            m[1] as number,
            m[2] as number,
            m[3] as number,
            m[4] as number,
            m[5] as number,
            m[6] as number,
            m[7] as number,
            m[8] as number,
            m[9] as number,
            m[10] as number,
            m[11] as number,
            m[12] as number,
            m[13] as number,
            m[14] as number,
            m[15] as number);
    } else {
        const scale = node["scale"] !== undefined ? node["scale"] as ReadonlyVec3 : [1,1,1] as ReadonlyVec3;
        const rotation = node["rotation"] !== undefined ? node["rotation"] as Array<number> : [0,0,0,1];
        const translation = node["translation"] !== undefined ? node["translation"] as ReadonlyVec3 : [0,0,0] as ReadonlyVec3;

        const m = mat4.create();
        return mat4.fromRotationTranslationScale(m, rotation, translation, scale);
    }
}

export function loadNodes(jsonChunk: any, sceneNodesJson: any, meshes: GLTFMesh[]) {
    const sceneNodes = [];
    for (const sceneNode of sceneNodesJson) {
        const n = jsonChunk["nodes"][sceneNode];
        const identity = mat4.create();
        mat4.identity(identity);
        const flattenedNodes = flattenTree(jsonChunk["nodes"], n, identity);

        for (const flattenedNode of flattenedNodes) {
            if ("mesh" in flattenedNode && flattenedNode["mesh"] != undefined) {
                sceneNodes.push(new GLTFNode(n["name"], flattenedNode["matrix"], meshes[flattenedNode["mesh"]]));
            }
        }
    }

    return sceneNodes;
}

export class GLTFNode {
    name: string;
    transfrom: mat4;
    mesh: GLTFMesh;
    nodeParamsBindGroup?: GPUBindGroup;
    constructor(name: string, transform: mat4, mesh: GLTFMesh) {
        this.name = name;
        this.transfrom = transform;
        this.mesh = mesh;
    }

    buildRenderPipeline(device: GPUDevice, shaderModule: GPUShaderModule, colorFormat: GPUTextureFormat,
        depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout) {
            const nodeParamsBuf = device.createBuffer({
                size: 16 *4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true
            });
            new Float32Array(nodeParamsBuf.getMappedRange()).set(this.transfrom);
            nodeParamsBuf.unmap();

            const bindGroupLayout = device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {type: "uniform"}
                    }
                ]
            });
            this.nodeParamsBindGroup = device.createBindGroup({
                layout: bindGroupLayout,
                entries:[{binding: 0, resource: {buffer: nodeParamsBuf}}]
            });

            this.mesh.buildRenderPipeline(device, shaderModule, colorFormat, depthFormat, uniformsBGLayout, bindGroupLayout);
    }

    render(renderPassEncoder: GPURenderPassEncoder) {
        renderPassEncoder.setBindGroup(1, this.nodeParamsBindGroup);
        this.mesh.render(renderPassEncoder)
    }
}