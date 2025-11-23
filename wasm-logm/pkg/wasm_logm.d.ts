/* tslint:disable */
/* eslint-disable */
/**
 * Geodesic interpolation using complex Schur decomposition (for orthogonal matrices only)
 *
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 */
export function geodesic_interp_eigen(a: Float64Array, b: Float64Array, t: number, n: number): Float64Array;
/**
 * Geodesic distance using complex Schur decomposition (for orthogonal matrices only)
 *
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 */
export function geodesic_distance_eigen(r: Float64Array, t: Float64Array, n: number): number;
/**
 * Matrix logarithm using complex Schur decomposition (for orthogonal matrices only)
 * This is an alternative implementation for testing and comparison.
 *
 * **Important**: This method only works correctly for orthogonal/unitary matrices.
 * For non-orthogonal matrices, use matrix_logm() instead.
 */
export function matrix_logm_eigen(matrix: Float64Array, n: number): Float64Array;
export function geodesic_interp(a: Float64Array, b: Float64Array, t: number, n: number): Float64Array;
export function geodesic_distance(r: Float64Array, t: Float64Array, n: number): number;
export function matrix_expm(matrix: Float64Array, n: number): Float64Array;
export function init(): void;
export function matrix_logm(matrix: Float64Array, n: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly geodesic_distance: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly geodesic_distance_eigen: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly geodesic_interp: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly geodesic_interp_eigen: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly matrix_expm: (a: number, b: number, c: number) => [number, number];
  readonly matrix_logm: (a: number, b: number, c: number) => [number, number];
  readonly matrix_logm_eigen: (a: number, b: number, c: number) => [number, number];
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
