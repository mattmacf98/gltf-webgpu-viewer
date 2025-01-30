import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFBuffer } from "./GLTFBuffer";
import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFComponentType, GLTFRenderMode, GLTFType } from "./GLTFEnums";
import { GLTFMaterial } from "./GLTFMaterial";
import { getPipelineForArgs } from "./GPUPipelineProvider";

export function loadPrimitives(jsonChunk: any, meshJson: any, accessors: GLTFAccessor[], materials: GLTFMaterial[]) {
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
            console.log("No texcoords found");
            const fakeTexCoordBufferByteLength = Float32Array.BYTES_PER_ELEMENT * 2 * positions.count;
            const buffer = new ArrayBuffer(fakeTexCoordBufferByteLength);
            const fakeBufferView = new GLTFBufferView(new GLTFBuffer(buffer, 0, fakeTexCoordBufferByteLength), fakeTexCoordBufferByteLength, 0, 2 * Float32Array.BYTES_PER_ELEMENT);
            fakeBufferView.addUsage(GPUBufferUsage.VERTEX);
            texcoords = new GLTFAccessor(fakeBufferView, positions.count, GLTFComponentType.FLOAT, GLTFType.VEC2, 0);
        }

        if (normals == null) {
            console.log("No normals found");
            const fakeNormalBufferByteLength = Float32Array.BYTES_PER_ELEMENT * 3 * positions.count;
            const buffer = new ArrayBuffer(fakeNormalBufferByteLength);
            const fakeBufferView = new GLTFBufferView(new GLTFBuffer(buffer, 0, fakeNormalBufferByteLength), fakeNormalBufferByteLength, 0, 3 * Float32Array.BYTES_PER_ELEMENT);
            fakeBufferView.addUsage(GPUBufferUsage.VERTEX);
            normals = new GLTFAccessor(fakeBufferView, positions.count, GLTFComponentType.FLOAT, GLTFType.VEC3, 0);
        }

        const material = materials[meshPrimitive["material"]];
        meshPrimitives.push(new GLTFPrimitive(material,positions, indices || undefined, texcoords, normals, topology));
    }

    return meshPrimitives;
}

export class GLTFPrimitive {
    material: GLTFMaterial;
    positions: GLTFAccessor;
    indices?: GLTFAccessor;
    texcoords: GLTFAccessor;
    normals: GLTFAccessor;
    topology: GLTFRenderMode;
    renderPipeline?: GPURenderPipeline;

    constructor(material: GLTFMaterial, positions: GLTFAccessor, indices: GLTFAccessor | undefined, texcoords: GLTFAccessor, normals: GLTFAccessor, topology: GLTFRenderMode) {
        this.material = material;
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
         depthFormat: GPUTextureFormat, uniformsBGLayout: GPUBindGroupLayout, nodeParamsBindGroupLayout: GPUBindGroupLayout) {
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

            if (this.texcoords) {
                if (this.texcoords.view.gpuBuffer === null) {
                    this.texcoords.view.upload(device);
                }
                vertexBuffers.push(
                    {
                        arrayStride: this.texcoords.byteStride,
                        attributes: [
                            {
                                format: this.texcoords.elementType as GPUVertexFormat,
                                offset: 0,
                                shaderLocation: 1
                            }
                        ]
                    }
                )
            }

            if (this.normals) {
                if (this.normals.view.gpuBuffer === null) {
                    this.normals.view.upload(device);
                }
                vertexBuffers.push(
                    {
                        arrayStride: this.normals.byteStride,
                        attributes: [
                            {
                                format: this.normals.elementType as GPUVertexFormat,
                                offset: 0,
                                shaderLocation: 2
                            }
                        ]
                    }
                )
            }

            const primitive = this.topology == GLTFRenderMode.TRIANGLE_STRIP ? {topology: "triangle-strip" as GPUPrimitiveTopology, stripIndexFormat: this.indices!.elementType as GPUIndexFormat} : {topology: "triangle-list" as GPUPrimitiveTopology};

            this.renderPipeline = getPipelineForArgs(vertexBuffers, primitive, colorFormat, depthFormat, this.material, uniformsBGLayout, nodeParamsBindGroupLayout, device, shaderModule)

    }

    render(renderPassEncoder: GPURenderPassEncoder) {
        renderPassEncoder.setPipeline(this.renderPipeline!);
        renderPassEncoder.setBindGroup(2, this.material.bindGroup);

        renderPassEncoder.setVertexBuffer(0,
            this.positions.view.gpuBuffer,
            this.positions.byteOffset,
            this.positions.byteLength
        );

        if (this.texcoords) {
            renderPassEncoder.setVertexBuffer(1,
                this.texcoords.view.gpuBuffer,
                this.texcoords.byteOffset,
                this.texcoords.byteLength
            );
        }

        if (this.normals) {
            renderPassEncoder.setVertexBuffer(2,
                this.normals.view.gpuBuffer,
                this.normals.byteOffset,
                this.normals.byteLength
            )
        }

        if (this.indices) {
            renderPassEncoder.setIndexBuffer(this.indices.view.gpuBuffer!, this.indices.elementType as GPUIndexFormat, this.indices.byteOffset, this.indices.byteLength);
            renderPassEncoder.drawIndexed(this.indices.count);
        } else {
            renderPassEncoder.draw(this.positions.count);
        }
    }
}