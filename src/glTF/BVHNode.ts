import { vec3 } from "gl-matrix";

export class BVHNode {
    private _minCorner: vec3;
    private _maxCorner: vec3;
    private _left: number;
    private _primitiveCount: number;

    constructor(minCorner: vec3, maxCorner: vec3) {
        this._minCorner = minCorner;
        this._maxCorner = maxCorner;
        this._left = -1;
        this._primitiveCount = -1;
    }

    set left(left: number) {
        this._left = left;
    }

    set primitiveCount(primitiveCount: number) {
        this._primitiveCount = primitiveCount;
    }

    set minCorner(minCorner: vec3) {
        this._minCorner = minCorner;
    }

    set maxCorner(maxCorner: vec3) {
        this._maxCorner = maxCorner;
    }

    get minCorner(): vec3 {
        return this._minCorner;
    }

    get maxCorner(): vec3 {
        return this._maxCorner;
    }

    get left(): number {
        return this._left;
    }

    get primitiveCount(): number {
        return this._primitiveCount;
    }
}
