alias float4 = vec4<f32>;
alias float3 = vec3<f32>;
alias float2 = vec2<f32>;

struct VertexInput {
    @location(0) position: float3,
    @location(1) texcoords: float2,
    @location(2) normal: float3
};

struct VertexOutput {
    @builtin(position) position: float4,
    @location(0) frag_pos: float3,
    @location(1) texcoords: float2,
    @location(2) normal: float3
};

struct ViewParams {
    view_proj: mat4x4<f32>,
};

struct CameraParams {
    camera_eye: float4,
};

struct NodeParams {
    model: mat4x4<f32>,
};

struct MaterialParams {
    base_color_factor: float4,
    metallic_factor: f32,
    roughness_factor: f32,
};

fn linear_to_srgb(x: f32) -> f32 {
    if (x <= 0.0031308) {
        return 12.92 * x;
    }
    return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

const lightColor = vec3f(1.0, 1.0, 0.0);
const lightIntensity = 4.0;
const ambientColor = vec3f(0.05);
const PI = 3.14159265359;

@group(0) @binding(0)
var<uniform> view_params: ViewParams;

@group(0) @binding(1)
var<uniform> camera_params: CameraParams;

@group(1) @binding(0)
var<uniform> node_params: NodeParams;

@group(2) @binding(0)
var<uniform> material_params: MaterialParams;

@group(2) @binding(1)
var base_color_sampler: sampler;

@group(2) @binding(2)
var base_color_texture: texture_2d<f32>;

@group(2) @binding(3)
var metallic_roughness_sampler: sampler;

@group(2) @binding(4)
var metallic_roughness_texture: texture_2d<f32>;

@group(2) @binding(5)
var normal_sampler: sampler;

@group(2) @binding(6)
var normal_texture: texture_2d<f32>;


@vertex
fn vertex_main(vert: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let worldPos = node_params.model * float4(vert.position, 1.0);

    out.position = view_params.view_proj * worldPos;
    out.frag_pos = worldPos.xyz;
    out.texcoords = vert.texcoords;

    let normal = normalize((node_params.model * float4(vert.normal, 0.0)).xyz);
    out.normal = normal;

    return out;
}

@fragment
fn fragment_main(in: VertexOutput) -> @location(0) float4 {
   let albedo = (textureSample(base_color_texture, base_color_sampler, in.texcoords) * material_params.base_color_factor).rgb;
   let metallicRouhgness = textureSample(metallic_roughness_texture, metallic_roughness_sampler, in.texcoords);
   let metallic = metallicRouhgness.r * material_params.metallic_factor;
   let roughness = metallicRouhgness.g * material_params.roughness_factor;

   let normal = normalize(textureSample(normal_texture, normal_sampler, in.texcoords).rgb * 2.0 - 1.0);
   let N = normalize(normal + in.normal);

   let camera_pos = camera_params.camera_eye.xyz;
   let V = normalize(camera_pos - in.frag_pos);
   let L = V;
   let H = normalize(V + L);

   let F0 = mix(float3(0.04), albedo, metallic);
   let F = F0 + (1.0 - F0) * pow(1.0 - dot(H, V), 5.0);

   let alpha = roughness * roughness;
   let NdotH = max(dot(N, H), 0.0);
   let D = (alpha * alpha) / (PI * pow(NdotH * NdotH * (alpha * alpha - 1.0) + 1.0, 2.0));

    let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let G = (NdotV / (NdotV * (1.0 - k) + k)) * (NdotL / (NdotL * (1.0 - k) + k));

    let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
    let kD = (1.0 - F) * (1.0 - metallic);
    let diffuse = kD * albedo / PI;

    let color = (diffuse + specular) * NdotL * lightColor * lightIntensity;

    var final_color = color + ambientColor * (1.0 - metallic);

    final_color.x = linear_to_srgb(final_color.x);
    final_color.y = linear_to_srgb(final_color.y);
    final_color.z = linear_to_srgb(final_color.z);

    return vec4<f32>(final_color, 1.0);
}