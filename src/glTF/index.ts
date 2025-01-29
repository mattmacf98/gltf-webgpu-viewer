import { GLTFAccessor, loadAccessors } from "./GLTFAccessor";
import { GLTFBuffer } from "./GLTFBuffer";
import { GLTFBufferView, loadBufferViews } from "./GLTFBufferView";
import { GLTFMesh, loadMesh } from "./GLTFMesh";
import { GLTFNode, loadNodes } from "./GLTFNode";
import { GLTFScene } from "./GLTFScene";

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
    const meshes: GLTFMesh[] = loadMesh(jsonChunk, accessors);

    bufferViews.forEach((bufferView: GLTFBufferView) => {
        if (bufferView.needsUpload) {
            bufferView.upload(device);
        }
    })
    
    const sceneNodesJson = jsonChunk["scenes"][0]["nodes"];
    const sceneNodes: GLTFNode[] = loadNodes(jsonChunk, sceneNodesJson, meshes);

    return new GLTFScene(sceneNodes);
}