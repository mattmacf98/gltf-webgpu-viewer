import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFBuffer } from "./GLTFBuffer";
import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFComponentType, GLTFRenderMode, GLTFType } from "./GLTFEnums";
import { getPipelineForArgs } from "./GPUPipelineProvider";

export function loadPrimitives(jsonChunk: any, meshJson: any, accessors: GLTFAccessor[]) {
    const meshPrimitives = [];
    for (const meshPrimitive of meshJson.primitives) {
        const topology = meshPrimitive["mode"] || GLTFRenderMode.TRIANGLES;
        
        let indices = null;
        if (jsonChunk["accessors"][meshPrimitive["indices"]] !== undefined) {
            indices = accessors[meshPrimitive["indices"]];
        }

        let positions = null;
        let texcoords = null;
        let normals = null;
        for (const attribute of Object.keys(meshPrimitive["attributes"])) {
            const accessor = accessors[meshPrimitive["attributes"][attribute]];
            if (attribute === "POSITION") {
                positions = accessor;
            } else if (attribute === "TEXCOORD_0") {
                texcoords = accessor;
            } else if (attribute === "NORMAL") {
                normals = accessor;
            }
        }

        if (positions == null) {
            throw new Error("No positions found");
        }

        if (texcoords == null) {
            const fakeTexCoordBufferByteLength = Float32Array.BYTES_PER_ELEMENT * 2 * positions.count;
            const buffer = new ArrayBuffer(fakeTexCoordBufferByteLength);
            const fakeBufferView = new GLTFBufferView(new GLTFBuffer(buffer, 0, fakeTexCoordBufferByteLength), fakeTexCoordBufferByteLength, 0, 2 * Float32Array.BYTES_PER_ELEMENT);
            fakeBufferView.addUsage(GPUBufferUsage.VERTEX);
            texcoords = new GLTFAccessor(fakeBufferView, positions.count, GLTFComponentType.FLOAT, GLTFType.VEC2, 0);
        }

        if (normals == null) {
            const fakeNormalBufferByteLength = Float32Array.BYTES_PER_ELEMENT * 3 * positions.count;
            const buffer = new ArrayBuffer(fakeNormalBufferByteLength);
            const fakeBufferView = new GLTFBufferView(new GLTFBuffer(buffer, 0, fakeNormalBufferByteLength), fakeNormalBufferByteLength, 0, 3 * Float32Array.BYTES_PER_ELEMENT);
            fakeBufferView.addUsage(GPUBufferUsage.VERTEX);
            normals = new GLTFAccessor(fakeBufferView, positions.count, GLTFComponentType.FLOAT, GLTFType.VEC3, 0);
        }

        meshPrimitives.push(new GLTFPrimitive(positions, indices || undefined, texcoords, normals, topology));
    }

    return meshPrimitives;
}

export class GLTFPrimitive {
    positions: GLTFAccessor;
    indices?: GLTFAccessor;
    texcoords: GLTFAccessor;
    normals: GLTFAccessor;
    topology: GLTFRenderMode;
    renderPipeline?: GPURenderPipeline;

    constructor(positions: GLTFAccessor, indices: GLTFAccessor | undefined, texcoords: GLTFAccessor, normals: GLTFAccessor, topology: GLTFRenderMode) {
        this.positions = positions;
        this.texcoords = texcoords;
        this.normals = normals;
        this.indices = indices;
        this.topology = topology;
        this.renderPipeline = undefined;

        this.positions.view.needsUpload = true;
        this.positions.view.addUsage(GPUBufferUsage.VERTEX);

        if (this.texcoords) {
            this.texcoords.view.needsUpload = true;
            this.texcoords.view.addUsage(GPUBufferUsage.VERTEX);
        }

        if (this.normals) {
            this.normals.view.needsUpload = true;
            this.normals.view.addUsage(GPUBufferUsage.VERTEX);
        }
    
        if (this.indices) {
            this.indices.view.needsUpload = true;
            this.indices.view.addUsage(GPUBufferUsage.INDEX);
        }
    }

    buildRenderPipeline(device: GPUDevice, shaderModule: GPUShaderModule, colorFormat: GPUTextureFormat,
         depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout) {
            const vertexBuffers: GPUVertexBufferLayout[] = [
                {
                    arrayStride: this.positions.byteStride,
                    attributes:[
                        {
                            format: this.positions.elementType as GPUVertexFormat,
                            offset: 0,
                            shaderLocation: 0
                        }
                    ]
                }
            ];

            const primitive = this.topology == GLTFRenderMode.TRIANGLE_STRIP ? {topology: "triangle-strip" as GPUPrimitiveTopology, stripIndexFormat: this.indices!.elementType as GPUIndexFormat} : {topology: "triangle-list" as GPUPrimitiveTopology};

            this.renderPipeline = getPipelineForArgs(vertexBuffers, primitive, colorFormat, depthFormat, uniformsBGLayout, device, shaderModule)

    }

    render(renderPassEncoder: GPURenderPassEncoder, viewParamBindGroup: GPUBindGroup) {
        renderPassEncoder.setPipeline(this.renderPipeline!);
        renderPassEncoder.setBindGroup(0, viewParamBindGroup);

        renderPassEncoder.setVertexBuffer(0,
            this.positions.view.gpuBuffer,
            this.positions.byteOffset,
            this.positions.byteLength
        );

        if (this.indices) {
            renderPassEncoder.setIndexBuffer(this.indices.view.gpuBuffer!, this.indices.elementType as GPUIndexFormat, this.indices.byteOffset, this.indices.byteLength);
            renderPassEncoder.drawIndexed(this.indices.count);
        } else {
            renderPassEncoder.draw(this.positions.count);
        }
    }
}