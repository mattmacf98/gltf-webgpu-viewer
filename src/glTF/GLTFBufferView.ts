import { GLTFBuffer } from "./GLTFBuffer";

function alignTo(val: number, align: number) {
    return Math.ceil(val  / align) * align;
}

export function loadBufferViews(jsonChunk: any, binaryChunk: GLTFBuffer) {
    const bufferViews: GLTFBufferView[] = [];
    for (const bufferView of jsonChunk.bufferViews) {
        let byteLength = bufferView["byteLength"] as number;
        let byteStride = 0;
        if ("byteStride" in bufferView) {
            byteStride = bufferView["byteStride"] as number;
        }
        let byteOffset = 0;
        if ("byteOffset" in bufferView) {
            byteOffset = bufferView["byteOffset"] as number;
        }
        bufferViews.push(new GLTFBufferView(binaryChunk, byteLength, byteOffset, byteStride));
    }

    return bufferViews;
}

export class GLTFBufferView {
    byteLength: number;
    byteStride: number;
    view: Uint8Array;
    needsUpload: boolean;
    gpuBuffer?: GPUBuffer;
    usage: GPUBufferUsageFlags;

    constructor(buffer: GLTFBuffer, byteLength: number, byteOffset: number, byteStride: number) {
        this.byteLength = byteLength;
        this.byteStride =  byteStride;

        this.view = buffer.buffer.subarray(byteOffset, byteOffset + this.byteLength);

        this.needsUpload = false;
        this.gpuBuffer = undefined;
        this.usage = 0;
    }

    addUsage(usage: GPUBufferUsageFlags) {
        this.usage = this.usage | usage;
    }

    upload(device: GPUDevice) {
        const buf = device.createBuffer({
            size: alignTo(this.view.byteLength, 4),
            usage: this.usage,
            mappedAtCreation: true
        });

        new Uint8Array(buf.getMappedRange()).set(this.view);
        buf.unmap();
        this.gpuBuffer = buf;
        this.needsUpload = false;
    }

    get elements(): Uint8Array {
        return this.view;
    }
}