import { GLTFAccessor, loadAccessors } from "./GLTFAccessor";
import { GLTFBuffer } from "./GLTFBuffer";
import { GLTFBufferView, loadBufferViews } from "./GLTFBufferView";
import { GLTFImage, loadImages } from "./GLTFImage";
import { GLTFMaterial, loadMaterials } from "./GLTFMaterial";
import { GLTFMesh, loadMesh } from "./GLTFMesh";
import { GLTFNode, loadNodes } from "./GLTFNode";
import { GLTFSampler, loadSamplers } from "./GLTFSampler";
import { GLTFScene } from "./GLTFScene";
import { GLTFTexture, loadTextures } from "./GLTFTexture";

export async function uploadGLB(buffer: ArrayBuffer, device: GPUDevice) {
    const header = new Uint32Array(buffer, 0, 5);

    if (header[0] != 0x46546C67) {
        throw Error("Invalid GLB magic");
    }
    if (header[1] != 2) {
        throw Error("Unsupported glb version (only glTF 2.0 is supported)")
    }
    if (header[4] != 0x4E4F534A) {
        throw Error("Invalid glB: The first chunk of the glB file should be JSON");
    }

    const jsonContentLength = header[3];
    const jsonChunk = JSON.parse(new TextDecoder("utf-8").decode(new Uint8Array(buffer, 20, jsonContentLength)));
    const binaryHeader = new Uint32Array(buffer, 20 + jsonContentLength, 2);
    if (binaryHeader[1] != 0x004E4942) {
        throw Error("Invalid glB: The second chunk of the glB file should be binary");   
    }
    const binaryContentLength = binaryHeader[0];
    const binaryChunk = new GLTFBuffer(buffer, 20  + jsonContentLength + 8, binaryContentLength);

    const bufferViews: GLTFBufferView[] = loadBufferViews(jsonChunk, binaryChunk)
    const accessors: GLTFAccessor[] = loadAccessors(jsonChunk, bufferViews);
    const samplers: GLTFSampler[] = loadSamplers(jsonChunk);
    const images: GLTFImage[] = await loadImages(jsonChunk, bufferViews);
    const textures: GLTFTexture[] = loadTextures(jsonChunk, images, samplers);
    const materials: GLTFMaterial[] = loadMaterials(jsonChunk, textures);
    const meshes: GLTFMesh[] = loadMesh(jsonChunk, accessors, materials);

    bufferViews.forEach((bufferView: GLTFBufferView) => {
        if (bufferView.needsUpload) {
            bufferView.upload(device);
        }
    });

    images.forEach((img: GLTFImage) => {
        img.upload(device);
    });
    samplers.forEach((sampler: GLTFSampler) => {
        sampler.create(device);
    });
    materials.forEach((material: GLTFMaterial) => {
        material.upload(device);
    })
    
    const sceneNodesJson = jsonChunk["scenes"][0]["nodes"];
    const sceneNodes: GLTFNode[] = loadNodes(jsonChunk, sceneNodesJson, meshes);

    return new GLTFScene(sceneNodes);
}