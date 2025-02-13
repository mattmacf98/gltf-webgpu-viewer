import { useEffect, useRef } from "react"
import raytracer_kernel from "./shaders/raytracer_kernel.wgsl?raw";
import screen_shader from "./shaders/screen_shader.wgsl?raw";
import { uploadGLB } from "./glTF";
import { Triangle } from "./glTF/Triangle";
import { ArcballCamera } from "arcball_camera";
import {Controller} from "ez_canvas_controller";
import { vec3 } from "gl-matrix";

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

    context?.configure({
      device: device,
      format: "bgra8unorm",
      alphaMode: "opaque"
    });

    const colorBuffer: GPUTexture = device?.createTexture({
      size: [canvas.width, canvas.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.COPY_DST |GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });
    const colorBufferView = colorBuffer.createView();
    const sampler: GPUSampler = device?.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      maxAnisotropy: 1
    });

    const sceneParamsBuffer = device?.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const scene = await fetch("./Avocado.glb")
      .then(res => res.arrayBuffer())
      .then(buffer => uploadGLB(buffer, device));

    const triangles: Triangle[] = scene.triangles;

    const trianglesBuffer = device?.createBuffer({
      size: 28 * Float32Array.BYTES_PER_ELEMENT * triangles.length,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // RAY TRACING PIPELINE
    const rayTracingBindGroupLayout = device?.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
              access: "write-only",
              format: "rgba8unorm",
              viewDimension: "2d"
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {type: 'uniform'},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {type: 'read-only-storage'},
        }
      ],
    });

    const rayTracingBindGroup = device?.createBindGroup({
      layout: rayTracingBindGroupLayout,
      entries: [
        {binding: 0, resource: colorBufferView},
        {binding: 1, resource: {buffer: sceneParamsBuffer}},
        {binding: 2, resource: {buffer: trianglesBuffer}},
      ]
    });

    const rayTracingPipeline: GPUComputePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({
          bindGroupLayouts: [rayTracingBindGroupLayout]
      }),
      compute: {
          module: device.createShaderModule({code: raytracer_kernel}),
          entryPoint: "main"
      }
  });

  // SCREEN PIPELINE
  const screenBindGroupLayout = device?.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler:{}
      },
      {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
      }
    ]
  });

  const screenBindGroup = device?.createBindGroup({
    layout: screenBindGroupLayout,
    entries: [
      {binding: 0, resource: sampler},
      {binding: 1, resource: colorBufferView}
    ]
  });

  const screenPipeline: GPURenderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
        bindGroupLayouts: [screenBindGroupLayout]
    }),
    vertex: {
        module: device.createShaderModule({code: screen_shader}),
        entryPoint: "vert_main"
    },
    fragment: {
        module: device.createShaderModule({code: screen_shader}),
        entryPoint: "frag_main",
        targets: [{format: "bgra8unorm"}]
    },
    primitive: {
        topology: "triangle-list"
    }
  });

  console.log(triangles.length)
  console.log(triangles)

  // UPLOAD TRIANGLES
  const trianglesUploadData = new Float32Array(triangles.length * 28);
  for (let i = 0; i < triangles.length; i++) {
    trianglesUploadData.set(triangles[i].positions[0], i * 28);
    trianglesUploadData.set(triangles[i].normals[0], i * 28 + 4)
    trianglesUploadData.set(triangles[i].positions[1], i * 28 + 8);
    trianglesUploadData.set(triangles[i].normals[1], i * 28 + 12);
    trianglesUploadData.set(triangles[i].positions[2], i * 28 + 16);
    trianglesUploadData.set(triangles[i].normals[2], i * 28 + 20);
    trianglesUploadData.set(triangles[i].color, i * 28 + 24);
  }
  device?.queue.writeBuffer(trianglesBuffer, 0, trianglesUploadData, 0);

  // UPLAOD SCENE PARAMS
  const maxBounces: number = 1;
  const camera = new ArcballCamera([0, 0, 0.3], [0, 0, 0], [0, 1, 0], 0.5, [
    canvas.width,
    canvas.height,
  ]);

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

  const sceneParamsUploadData = new Float32Array(16);
  sceneParamsUploadData.set([0,0,-5], 0);// position
  sceneParamsUploadData.set([0,0,1], 4); // forward
  sceneParamsUploadData.set([-1,0,0], 8); // right
  sceneParamsUploadData.set([maxBounces], 11); // max bounces
  sceneParamsUploadData.set([0,1,0], 12); // up
  sceneParamsUploadData.set([triangles.length], 15);
  device?.queue.writeBuffer(sceneParamsBuffer, 0, sceneParamsUploadData, 0);

  const frame = function() {
    const start = performance.now()

    //todo consider splitting from other scene data
    const sceneParamsUpdateBuffer = device.createBuffer({
      size: 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });

    const upVec3: vec3 = new Float32Array([camera.upDir()[0], camera.upDir()[1], camera.upDir()[2]]);
    const forwardVec3: vec3 = new Float32Array([camera.eyeDir()[0], camera.eyeDir()[1], camera.eyeDir()[2]]);
    const rightVec3: vec3 = vec3.create();
    vec3.cross(rightVec3, forwardVec3, upVec3);
    vec3.normalize(rightVec3, rightVec3);
    const sceneParamsUpdateData = new Float32Array(16);
    sceneParamsUpdateData.set([camera.eyePos()[0], camera.eyePos()[1], camera.eyePos()[2]], 0);
    sceneParamsUpdateData.set([camera.eyeDir()[0], camera.eyeDir()[1], camera.eyeDir()[2]], 4);
    sceneParamsUpdateData.set([camera.upDir()[0], camera.upDir()[1], camera.upDir()[2]], 8);
    sceneParamsUpdateData.set([maxBounces], 11);
    sceneParamsUpdateData.set([rightVec3[0], rightVec3[1], rightVec3[2]], 12);
    sceneParamsUpdateData.set([triangles.length], 15);
    device?.queue.writeBuffer(sceneParamsUpdateBuffer, 0, sceneParamsUpdateData, 0);


    const commandEncoder: GPUCommandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(sceneParamsUpdateBuffer, 0, sceneParamsBuffer, 0, 16 * Float32Array.BYTES_PER_ELEMENT);

      const ray_tacer_pass: GPUComputePassEncoder = commandEncoder.beginComputePass();
      ray_tacer_pass.setPipeline(rayTracingPipeline);
      ray_tacer_pass.setBindGroup(0, rayTracingBindGroup);
      ray_tacer_pass.dispatchWorkgroups(canvas.width, canvas.height, 1);
      ray_tacer_pass.end();

      const textureView: GPUTextureView = context.getCurrentTexture().createView();
      const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass({
          colorAttachments: [{
              view: textureView,
              clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
              loadOp: "clear",
              storeOp: "store"
          }]
      });
      renderpass.setPipeline(screenPipeline);
      renderpass.setBindGroup(0, screenBindGroup);
      renderpass.draw(6, 1, 0, 0);
      renderpass.end();
  
      device.queue.submit([commandEncoder.finish()]);
      device.queue.onSubmittedWorkDone()
      .then(() => {
          const end = performance.now();
          console.log(`Render Time: ${end - start}ms`);
      });
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


// TODO:
// 2. get basic box to render (something is wrong with my triangles)
// 3. add accurate diffuse color to the triangles