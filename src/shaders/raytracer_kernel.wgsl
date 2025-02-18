@group(0) @binding(0)
var color_buffer: texture_storage_2d<rgba8unorm, write>;

@group(0) @binding(1)
var<uniform> scene: SceneData;

@group(0) @binding(2)
var<storage, read> primitives: PrimitiveData;

struct PrimitiveData {
    triangles: array<Triangle>
}

struct Triangle {
    corner_a: vec3<f32>,
    normal_a: vec3<f32>,
    corner_b: vec3<f32>,
    normal_b: vec3<f32>,
    corner_c: vec3<f32>,
    normal_c: vec3<f32>,
    color: vec3<f32>
}

struct Ray {
    origin: vec3<f32>,
    direction: vec3<f32>
}

struct SceneData {
    cameraPos: vec3<f32>,
    cameraForward: vec3<f32>,
    cameraRight: vec3<f32>,
    maxBounces: f32,
    cameraUp: vec3<f32>,
    trianglesCount: f32
}

struct RenderState {
    t: f32,
    color: vec3<f32>,
    hit: bool,
    scatter_direction: vec3<f32>,
}

@compute @workgroup_size(1,1,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID: vec3<u32>) {
    let screen_size: vec2<u32> = textureDimensions(color_buffer);
    let screen_pos: vec2<i32> = vec2(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

    let horizontal_coefficient: f32 = (f32(screen_pos.x) - f32(screen_size.x) / 2.0) / f32(screen_size.x);
    let vertical_coefficient: f32 = (f32(screen_pos.y) - f32(screen_size.y) / 2.0) / f32(screen_size.x);
    
    let forwards: vec3<f32> = scene.cameraForward;
    let right: vec3<f32> = scene.cameraRight;
    let up: vec3<f32> = scene.cameraUp;

    var ray: Ray = Ray(scene.cameraPos, normalize(forwards + right * horizontal_coefficient + up * vertical_coefficient));

    var pixel_color: vec3<f32> = rayColor(ray);

    textureStore(color_buffer, screen_pos, vec4(pixel_color, 1.0));
}

fn rayColor(ray: Ray) -> vec3<f32> {
    var color: vec3<f32> = vec3(1.0, 1.0, 1.0);
    var result: RenderState;
   
    var worldRay: Ray;
    worldRay.origin = ray.origin;
    worldRay.direction = ray.direction;

    var bounce: u32 = u32(0);
    while (bounce < u32(scene.maxBounces)) {
        // we will bounce a certain number of times
        result.hit = false;
        result.t = 1.0e30;

        for (var t: u32 = u32(0); t < u32(scene.trianglesCount); t++) {
            // find the closest triangle
            result = hit_triangle(worldRay, primitives.triangles[t], 0.001, result.t, result);
        }

        
        if (!result.hit) {
            // if we didn't hit anything we will break
            break;
        } else {
            // if we hit something we will update the ray and accumulated color
            worldRay.origin = worldRay.origin + result.t * worldRay.direction;
            worldRay.direction = result.scatter_direction;
            color *= result.color;
        }
        bounce++;
    }

    if (bounce >= u32(scene.maxBounces)) {
        // if we were still hitting stuff when we are bouncing we will set the color to black (mean we are in a shadow)
        color = vec3(0.0, 0.0, 0.0);
    }

    return color;
}

fn hit_triangle(ray:Ray, triangle: Triangle, tMin: f32, tMax: f32, oldRenderState: RenderState) -> RenderState {
    // TODO: precompute surface normal and pass in with triangle
    var edgeAB: vec3<f32> = triangle.corner_b - triangle.corner_a;
    var edgeAC: vec3<f32> = triangle.corner_c - triangle.corner_a;
    var surface_normal: vec3<f32> = cross(edgeAB, edgeAC);

    var tri_normal_dot_ray_dir: f32 = dot(surface_normal, ray.direction);
    var front_face: bool = tri_normal_dot_ray_dir < 0.0;
    if (!front_face) {
        // flip normal if ray hits back face
        // surface_normal = -surface_normal;
        // tri_normal_dot_ray_dir = -tri_normal_dot_ray_dir;
        //TODO: if we ever need to send rays through objects (refraction) we cannot simply ignore back faces
        return oldRenderState;
    }

    if (tri_normal_dot_ray_dir > -0.00001) {
        // ray is parallel to triangle
        return oldRenderState;
    }

    
    var denom = dot(surface_normal, ray.direction);
    if (abs(denom) < 0.00001) {
        return oldRenderState;
    }

    var d = dot(surface_normal, triangle.corner_a); //TODO this could be in tri data
    var t = (d - dot(surface_normal, ray.origin)) / denom;
    if (t < tMin || t > tMax) {
        return oldRenderState;
    }

    // cramer's rule to solve for barycentric coordinates
    // TODO: see if I can make the barycentric coord code more clear
    var intersection_point: vec3<f32> = ray.origin + t * ray.direction;
    var plane_intersection_point: vec3<f32> = intersection_point - triangle.corner_a;
    var w = surface_normal / dot(surface_normal, surface_normal);

    var u = dot(w, cross(plane_intersection_point, edgeAC));
    if (u < 0.0 || u > 1.0) {
        return oldRenderState;
    }

    var v = dot(w, cross(edgeAB, plane_intersection_point));
    if (v < 0.0 || u + v > 1.0) {
        return oldRenderState;
    }

    var normal = (1.0 - u - v) * triangle.normal_a + u * triangle.normal_b + v * triangle.normal_c;
    var onb_u = normalize(normal);
    var onb_v = normalize(cross(vec3(0.0, 1.0, 0.0), onb_u));
    var onb_w = normalize(cross(onb_u, onb_v));
    var random_cosine_direction = random_cosine_direction();
    var scatter_direction = onb_u * random_cosine_direction.x + onb_v * random_cosine_direction.y + onb_w * random_cosine_direction.z;

    var renderState: RenderState;
    renderState.color = oldRenderState.color;
    renderState.scatter_direction = normalize(scatter_direction);
    renderState.t = t;
    renderState.hit = true;
    renderState.color = triangle.color;

    return renderState;
}

fn random_cosine_direction() -> vec3<f32> {
    var r1: f32 = random(vec2(0.0, 0.0));
    var r2: f32 = random(vec2(1.0, 1.0));
    var phi = 2.0 * 3.1415926535897932384626433832795 * r1;
    return vec3(cos(phi) * sqrt(r2), sin(phi) * sqrt(r2), sqrt(1.0 - r2));
}

fn random(uv: vec2<f32>) -> f32 {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453123);
}