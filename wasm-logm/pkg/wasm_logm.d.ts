/* tslint:disable */
/* eslint-disable */
export function init(): void;
export function matrix_expm(matrix: Float64Array, n: number): Float64Array;
/**
 * Geodesic interpolation for orthogonal matrices
 * 
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 */
export function geodesic_interp(a: Float64Array, b: Float64Array, t: number, n: number): Float64Array;
/**
 * Geodesic distance for orthogonal matrices
 * 
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 */
export function geodesic_distance(r: Float64Array, t: Float64Array, n: number): number;
/**
 * Matrix logarithm for orthogonal matrices
 * 
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 */
export function matrix_logm(matrix: Float64Array, n: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly geodesic_distance: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly geodesic_interp: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly matrix_expm: (a: number, b: number, c: number) => [number, number];
  readonly matrix_logm: (a: number, b: number, c: number) => [number, number];
  readonly init: () => void;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
