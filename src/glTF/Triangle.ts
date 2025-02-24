export class Triangle {
    private _positions: Float32Array[];
    private _normals: Float32Array[];
    private _uvs: Float32Array[];
    private _centroid: Float32Array;
    private _ior: number;
    private _metalness: number;

    constructor(positions: Float32Array[], normals: Float32Array[], uvs: Float32Array[], ior: number, metalness: number) {
        this._positions = positions;
        this._normals = normals;
        this._uvs = uvs;
        this._ior = ior;
        this._metalness = metalness;
        this._centroid = new Float32Array([0,0,0]);
        const weights = [0.3333333333333333, 0.3333333333333333, 0.3333333333333333];
        for(const position of positions) {
            this._centroid[0] += position[0] * weights[0];
            this._centroid[1] += position[1] * weights[1];
            this._centroid[2] += position[2] * weights[2];
        }
    }

    get positions(): Float32Array[] {
        return this._positions;
    }

    get uvs(): Float32Array[] {
        return this._uvs;
    }

    get centroid(): Float32Array {
        return this._centroid;
    }

    get normals(): Float32Array[] {
        return this._normals;
    }

    get ior(): number {
        return this._ior;
    }

    get metalness(): number {
        return this._metalness;
    }
}