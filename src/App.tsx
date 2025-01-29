import { useEffect, useRef } from "react"
import gltfShader from "./gltf-shader.wgsl?raw";
import { uploadGLB } from "./glTF";
import { ArcballCamera } from "arcball_camera";
import {Controller} from "ez_canvas_controller";
import * as glMatrix from "gl-matrix";

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    initWebGPU();
  }, []);

  const initWebGPU = async () => {
    //aquire and configure the GPU
    if (navigator.gpu === undefined) {
      alert('WebGPU is not supported');
      return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
      alert('Failed to create GPU device');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      alert('Failed to get canvas');
      return;
    }
    const context = canvas.getContext('webgpu');
    if (!context) {
      alert('Failed to get webgpu context');
      return;
    }

    // configure canvas, deth texture and some uniforms
    context?.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthTexture = device?.createTexture({
      size: [canvas.width, canvas.height, 1],
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const viewParamBindGroupLayout = device?.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {type: 'uniform'},
      }],
    });
    const viewParamBuffer = device?.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const viewParamBindGroup = device?.createBindGroup({
      layout: viewParamBindGroupLayout,
      entries: [{
        binding: 0,
        resource: {buffer: viewParamBuffer},
      }],
    });

    const mesh = await fetch("./Avocado.glb")
      .then(res => res.arrayBuffer())
      .then(buffer => uploadGLB(buffer, device));

    const shaderModule = await device?.createShaderModule({
      code: gltfShader,
    });

    mesh.buildRenderPipeline(device, shaderModule, navigator.gpu.getPreferredCanvasFormat(), 'depth24plus-stencil8', viewParamBindGroupLayout);

    const camera = new ArcballCamera([0, 0, 0.3], [0, 0, 0], [0, 1, 0], 0.5, [
      canvas.width,
      canvas.height,
    ]);

    const projection = glMatrix.mat4.perspective(
        glMatrix.mat4.create(),
        (50 * Math.PI) / 180.0,
        canvas.width / canvas.height,
        0.1,
        1000
    );

    let projView = glMatrix.mat4.create();
    const controller = new Controller();

    controller.mousemove = function (prev: any, cur: any, event: { buttons: number; }) {
        if (event.buttons == 1) {
            camera.rotate(prev, cur);
        } else if (event.buttons == 2) {
            camera.pan([cur[0] - prev[0], prev[1] - cur[1]])
        }
    }
    controller.wheel = function (amount: number) {
        camera.zoom(amount * 0.5);
    }
    controller.registerForCanvas(canvas);

    const renderPassDesc = {
      colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          loadOp:"clear" as GPULoadOp,
          loadValue: [0.3, 0.3, 0.3, 1],
          storeOp: "store" as GPUStoreOp
      }],
      depthStencilAttachment: {
          view: depthTexture.createView(),
          depthLoadOp: "clear" as GPULoadOp,
          depthClearValue: 1.0,
          depthStoreOp: "store" as GPUStoreOp,
          stencilLoadOp: "clear" as GPULoadOp,
          stencilClearValue: 0,
          stencilStoreOp: "store" as GPUStoreOp
      }
    }

    const frame = function() {
      const viewParamUpdateBuffer = device.createBuffer({
          size: 16 * Float32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_SRC,
          mappedAtCreation: true
      });
      projView = glMatrix.mat4.mul(projView, projection, camera.camera);
      const map = new Float32Array(viewParamUpdateBuffer.getMappedRange());
      map.set(projView);
      viewParamUpdateBuffer.unmap();

      renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();

      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(viewParamUpdateBuffer, 0, viewParamBuffer, 0, 16 * Float32Array.BYTES_PER_ELEMENT);
      const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
      mesh.render(renderPass, viewParamBindGroup);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
      viewParamUpdateBuffer.destroy();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
      <canvas width="800" height="600" style={{border: '1px solid black'}} ref={canvasRef}></canvas>
    </div>
  )
}

export default App;
