const pipelineGPUData = new Map();
let numPipelines = 0;

export function getPipelineForArgs(vertexBufferLayouts: GPUVertexBufferLayout[], primitive: GPUPrimitiveState, colorFormat: GPUTextureFormat, depthFormat: GPUTextureFormat,
     uniformsBGLayout: GPUBindGroupLayout, device: GPUDevice, shaderModule: GPUShaderModule) {

    const key = JSON.stringify({vertexBufferLayouts, primitive});
    let pipeline = pipelineGPUData.get(key);
    if (pipeline) {
        return pipeline;
    }
   
    numPipelines++;
    console.log(`Pipeline #${numPipelines}`);

    const layout = device.createPipelineLayout({
        bindGroupLayouts: [uniformsBGLayout]
    });

    pipeline = device.createRenderPipeline({
        vertex: {
            entryPoint: "vertex_main",
            module: shaderModule,
            buffers: vertexBufferLayouts
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragment_main",
            targets: [
                {
                    format: colorFormat,
                }
            ],
        },
        primitive: {
            ...primitive,
            cullMode:"back",
        },
        depthStencil: {
            format: depthFormat,
            depthWriteEnabled: true,
            depthCompare: "less"
        },
        layout: layout
    });

    pipelineGPUData.set(key, pipeline);

    return pipeline;
}