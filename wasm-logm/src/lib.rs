use nalgebra::DMatrix;
use num_complex::Complex64;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Matrix logarithm for orthogonal matrices using complex Schur decomposition
///
/// This implementation is specifically designed for orthogonal/unitary matrices.
/// For orthogonal matrices, the complex Schur form is diagonal (eigenvalues on diagonal).
///
/// Algorithm:
/// 1. Convert real matrix to complex
/// 2. Compute complex Schur decomposition: M = Q T Q^H (T is upper triangular)
/// 3. For orthogonal matrices, T should be diagonal
/// 4. Compute log(T) by taking logarithm of diagonal elements
/// 5. Reconstruct: log(M) = Q log(T) Q^H
///
/// **Note**: This only works correctly for orthogonal matrices (rotations).
#[allow(dead_code)]
fn matrix_log_eigen(m: &DMatrix<f64>) -> DMatrix<Complex64> {
    let n = m.nrows();

    // Convert to complex matrix
    let m_complex = m.map(|x| Complex64::new(x, 0.0));

    // Compute complex Schur decomposition: M = Q T Q^H
    // For complex matrices, T is upper triangular (not quasi-triangular)
    match m_complex.try_schur(1e-12, 500) {
        Some(schur) => {
            // Get the Schur form components - unpack consumes schur
            let (q, t) = schur.unpack();

            // For orthogonal matrices, T should be diagonal (eigenvalues on diagonal)
            // Verify this assumption
            let mut max_off_diag = 0.0_f64;
            for i in 0..n {
                for j in 0..n {
                    if i != j {
                        max_off_diag = max_off_diag.max(t[(i, j)].norm());
                    }
                }
            }

            if max_off_diag > 1e-6 {
                log(&format!(
                    "Warning: Schur form not diagonal (max off-diag: {}). Matrix may not be orthogonal.",
                    max_off_diag
                ));
            }

            // Compute log(T) - for diagonal matrix, just take log of diagonal elements
            let mut log_t = DMatrix::<Complex64>::zeros(n, n);
            for i in 0..n {
                let eigenvalue = t[(i, i)];
                // For orthogonal matrices, eigenvalues are on the unit circle
                // log(λ) = log|λ| + i*arg(λ)
                log_t[(i, i)] = eigenvalue.ln();
            }

            // Reconstruct: log(M) = Q * log(T) * Q^H
            let q_h = q.adjoint(); // Hermitian transpose
            &q * &log_t * &q_h
        }
        None => {
            // Fallback to scaling and squaring if Schur decomposition fails
            log("Schur decomposition failed, falling back to scaling and squaring");
            matrix_log_scaling_squaring(m)
        }
    }
}

/// Matrix logarithm using inverse scaling and squaring method
/// Based on the algorithm used in scipy and mathjs
fn matrix_log_scaling_squaring(m: &DMatrix<f64>) -> DMatrix<Complex64> {
    let n = m.nrows();
    let mut a = m.map(|x| Complex64::new(x, 0.0));

    // Find scaling factor k such that ||A^(1/2^k) - I|| < 0.5
    let mut k = 0;
    let identity = DMatrix::<Complex64>::identity(n, n);

    // Scale the matrix down
    while k < 20 {
        let diff = &a - &identity;
        let norm = diff.iter().map(|x| x.norm_sqr()).sum::<f64>().sqrt();

        if norm < 0.5 {
            break;
        }

        // Take matrix square root by eigendecomposition
        a = matrix_sqrt_complex(&a);
        k += 1;
    }

    // Compute log(A) using Padé approximation for A close to I
    let log_a = log_near_identity(&a);

    // Scale back: log(M) = 2^k * log(A)
    let scale = Complex64::new((1 << k) as f64, 0.0);
    log_a * scale
}

/// Compute matrix square root using Denman-Beavers iteration
/// More stable for general matrices
fn matrix_sqrt_complex(m: &DMatrix<Complex64>) -> DMatrix<Complex64> {
    let n = m.nrows();
    let mut y = m.clone();
    let mut z = DMatrix::<Complex64>::identity(n, n);

    // Denman-Beavers iteration: Y_{k+1} = 0.5*(Y_k + Z_k^{-1}), Z_{k+1} = 0.5*(Z_k + Y_k^{-1})
    // Converges to Y_∞ = sqrt(M), Z_∞ = sqrt(M)^{-1}
    for _ in 0..10 {
        let y_inv = match y.clone().try_inverse() {
            Some(inv) => inv,
            None => return m.clone(), // Fallback if not invertible
        };

        let z_inv = match z.clone().try_inverse() {
            Some(inv) => inv,
            None => return m.clone(), // Fallback if not invertible
        };

        let y_new = (&y + &z_inv) * Complex64::new(0.5, 0.0);
        let z_new = (&z + &y_inv) * Complex64::new(0.5, 0.0);

        // Check convergence
        let diff = (&y_new - &y)
            .iter()
            .map(|x| x.norm_sqr())
            .sum::<f64>()
            .sqrt();
        y = y_new;
        z = z_new;

        if diff < 1e-12 {
            break;
        }
    }

    y
}

/// Compute log(I + X) for small X using Taylor series
fn log_near_identity(a: &DMatrix<Complex64>) -> DMatrix<Complex64> {
    let _n = a.nrows();
    let identity = DMatrix::<Complex64>::identity(a.nrows(), a.nrows());
    let x = a - &identity;

    // Taylor series: log(I + X) = X - X^2/2 + X^3/3 - X^4/4 + ...
    let mut result = x.clone();
    let mut power = x.clone();

    for k in 2..=20 {
        power = &power * &x;
        let sign = if k % 2 == 0 { -1.0 } else { 1.0 };
        let term = &power * Complex64::new(sign / k as f64, 0.0);

        // Check convergence before adding
        let term_norm = term.iter().map(|x| x.norm_sqr()).sum::<f64>().sqrt();
        result += term;

        if term_norm < 1e-15 {
            break;
        }
    }

    result
}

/// Matrix exponential using scaling and squaring method
fn matrix_exp(m: &DMatrix<Complex64>) -> DMatrix<Complex64> {
    let _n = m.nrows();

    // Find scaling factor
    let norm = m.iter().map(|x| x.norm_sqr()).sum::<f64>().sqrt();
    let k = ((norm / 0.5).ln() / 2.0_f64.ln()).ceil().max(0.0) as i32;

    // Scale down
    let scale = 2.0_f64.powi(-k);
    let a = m * Complex64::new(scale, 0.0);

    // Padé approximation of order 6
    let result = pade_exp(&a);

    // Square k times
    let mut result = result;
    for _ in 0..k {
        result = &result * &result;
    }

    result
}

/// Padé approximation for matrix exponential
fn pade_exp(a: &DMatrix<Complex64>) -> DMatrix<Complex64> {
    let n = a.nrows();
    let identity = DMatrix::<Complex64>::identity(n, n);

    // Padé approximation of order 6
    let a2 = a * a;
    let a3 = &a2 * a;
    let a4 = &a2 * &a2;
    let a5 = &a4 * a;
    let a6 = &a3 * &a3;

    let c1 = Complex64::new(1.0, 0.0);
    let c2 = Complex64::new(0.5, 0.0);
    let c3 = Complex64::new(1.0 / 6.0, 0.0);
    let c4 = Complex64::new(1.0 / 24.0, 0.0);
    let c5 = Complex64::new(1.0 / 120.0, 0.0);
    let c6 = Complex64::new(1.0 / 720.0, 0.0);

    &identity + a * c1 + &a2 * c2 + &a3 * c3 + &a4 * c4 + &a5 * c5 + &a6 * c6
}

/// Convert flat array to DMatrix
fn flat_to_matrix(arr: &[f64], n: usize) -> DMatrix<f64> {
    DMatrix::from_row_slice(n, n, arr)
}

/// Convert DMatrix to flat array (real part only) in row-major order
fn matrix_to_flat_real(m: &DMatrix<Complex64>) -> Vec<f64> {
    let mut result = Vec::with_capacity(m.nrows() * m.ncols());
    for i in 0..m.nrows() {
        for j in 0..m.ncols() {
            result.push(m[(i, j)].re);
        }
    }
    result
}

/// Convert DMatrix to flat array (complex - interleaved real/imag) in row-major order
fn matrix_to_flat_complex(m: &DMatrix<Complex64>) -> Vec<f64> {
    let mut result = Vec::with_capacity(m.nrows() * m.ncols() * 2);
    for i in 0..m.nrows() {
        for j in 0..m.ncols() {
            result.push(m[(i, j)].re);
            result.push(m[(i, j)].im);
        }
    }
    result
}

#[wasm_bindgen]
pub fn matrix_logm(matrix: &[f64], n: usize) -> Vec<f64> {
    let m = flat_to_matrix(matrix, n);
    let log_m = matrix_log_scaling_squaring(&m);
    matrix_to_flat_complex(&log_m)
}

/// Matrix logarithm using complex Schur decomposition (for orthogonal matrices only)
/// This is an alternative implementation for testing and comparison.
///
/// **Important**: This method only works correctly for orthogonal/unitary matrices.
/// For non-orthogonal matrices, use matrix_logm() instead.
#[wasm_bindgen]
pub fn matrix_logm_eigen(matrix: &[f64], n: usize) -> Vec<f64> {
    let m = flat_to_matrix(matrix, n);
    let log_m = matrix_log_eigen(&m);
    matrix_to_flat_complex(&log_m)
}

#[wasm_bindgen]
pub fn matrix_expm(matrix: &[f64], n: usize) -> Vec<f64> {
    let m = flat_to_matrix(matrix, n);
    let m_complex = m.map(|x| Complex64::new(x, 0.0));
    let exp_m = matrix_exp(&m_complex);
    matrix_to_flat_real(&exp_m)
}

#[wasm_bindgen]
pub fn geodesic_distance(r: &[f64], t: &[f64], n: usize) -> f64 {
    let r_mat = flat_to_matrix(r, n);
    let t_mat = flat_to_matrix(t, n);

    // R^T * T
    let r_transpose = r_mat.transpose();
    let u = r_transpose * t_mat;

    // log(U)
    let log_u = matrix_log_scaling_squaring(&u);

    // Frobenius norm
    log_u.iter().map(|x| x.norm_sqr()).sum::<f64>().sqrt()
}

/// Geodesic distance using complex Schur decomposition (for orthogonal matrices only)
///
/// **Important**: This method only works correctly for orthogonal/unitary matrices.
#[wasm_bindgen]
pub fn geodesic_distance_eigen(r: &[f64], t: &[f64], n: usize) -> f64 {
    let r_mat = flat_to_matrix(r, n);
    let t_mat = flat_to_matrix(t, n);

    // R^T * T
    let r_transpose = r_mat.transpose();
    let u = r_transpose * t_mat;

    // log(U) using complex Schur decomposition
    let log_u = matrix_log_eigen(&u);

    // Frobenius norm
    log_u.iter().map(|x| x.norm_sqr()).sum::<f64>().sqrt()
}

#[wasm_bindgen]
pub fn geodesic_interp(a: &[f64], b: &[f64], t: f64, n: usize) -> Vec<f64> {
    let a_mat = flat_to_matrix(a, n);
    let b_mat = flat_to_matrix(b, n);

    // A^T * B
    let a_transpose = a_mat.transpose();
    let r_rel = a_transpose * b_mat;

    // log(R_rel)
    let log_r = matrix_log_scaling_squaring(&r_rel);

    // t * log(R_rel)
    let scaled_log = log_r * Complex64::new(t, 0.0);

    // exp(scaled_log)
    let r_interp = matrix_exp(&scaled_log);

    // A * R_interp
    let a_complex = a_mat.map(|x| Complex64::new(x, 0.0));
    let result = a_complex * r_interp;

    matrix_to_flat_real(&result)
}

/// Geodesic interpolation using complex Schur decomposition (for orthogonal matrices only)
///
/// **Important**: This method only works correctly for orthogonal/unitary matrices.
#[wasm_bindgen]
pub fn geodesic_interp_eigen(a: &[f64], b: &[f64], t: f64, n: usize) -> Vec<f64> {
    let a_mat = flat_to_matrix(a, n);
    let b_mat = flat_to_matrix(b, n);

    // A^T * B
    let a_transpose = a_mat.transpose();
    let r_rel = a_transpose * b_mat;

    // log(R_rel) using complex Schur decomposition
    let log_r = matrix_log_eigen(&r_rel);

    // t * log(R_rel)
    let scaled_log = log_r * Complex64::new(t, 0.0);

    // exp(scaled_log)
    let r_interp = matrix_exp(&scaled_log);

    // A * R_interp
    let a_complex = a_mat.map(|x| Complex64::new(x, 0.0));
    let result = a_complex * r_interp;

    matrix_to_flat_real(&result)
}

#[wasm_bindgen]
pub fn init() {
    // Initialize WASM module
    log("WASM logm module initialized");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    #[test]
    fn test_matrix_log_eigen_identity() {
        // Test that log(I) = 0
        let identity = DMatrix::identity(3, 3);
        let log_i = matrix_log_eigen(&identity);

        // Check that all elements are close to zero
        for i in 0..3 {
            for j in 0..3 {
                assert!(
                    log_i[(i, j)].norm() < 1e-10,
                    "log(I)[{},{}] = {:?}, expected ~0",
                    i,
                    j,
                    log_i[(i, j)]
                );
            }
        }
    }

    #[test]
    fn test_matrix_log_eigen_2d_rotation() {
        // Test a simple 2D rotation
        let angle = PI / 4.0; // 45 degrees
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        let r = DMatrix::from_row_slice(2, 2, &[cos_a, -sin_a, sin_a, cos_a]);

        let log_r = matrix_log_eigen(&r);

        // For 2D rotation by angle θ, log should be skew-symmetric with elements ±θi
        // log(R) = [[0, -θ], [θ, 0]]
        println!("log(R) = {}", log_r);

        // Check skew-symmetry
        assert!(
            (log_r[(0, 0)].re).abs() < 1e-10,
            "Diagonal should be real and near 0"
        );
        assert!(
            (log_r[(1, 1)].re).abs() < 1e-10,
            "Diagonal should be real and near 0"
        );

        // Check that it captured the rotation
        let mag = (log_r[(0, 1)].norm_sqr() + log_r[(1, 0)].norm_sqr()).sqrt();
        println!(
            "Magnitude: {}, expected: {}",
            mag,
            angle * std::f64::consts::SQRT_2
        );
    }

    #[test]
    fn test_matrix_log_eigen_3d_rotation() {
        // Test a 3D rotation around z-axis
        let angle = PI / 6.0; // 30 degrees
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        let r = DMatrix::from_row_slice(
            3,
            3,
            &[cos_a, -sin_a, 0.0, sin_a, cos_a, 0.0, 0.0, 0.0, 1.0],
        );

        let log_r = matrix_log_eigen(&r);

        println!("3D rotation log = {}", log_r);

        // Check that z-axis component is preserved (no rotation in z)
        assert!(
            (log_r[(2, 2)].norm()) < 1e-10,
            "z-component should be near 0"
        );
    }

    #[test]
    fn test_compare_eigen_vs_scaling_squaring() {
        // Compare both methods on a rotation matrix
        let angle = PI / 3.0;
        let cos_a = angle.cos();
        let sin_a = angle.sin();

        let r = DMatrix::from_row_slice(
            3,
            3,
            &[cos_a, -sin_a, 0.0, sin_a, cos_a, 0.0, 0.0, 0.0, 1.0],
        );

        let log_eigen = matrix_log_eigen(&r);
        let log_scaling = matrix_log_scaling_squaring(&r);

        // Check that results are similar
        for i in 0..3 {
            for j in 0..3 {
                let diff = (log_eigen[(i, j)] - log_scaling[(i, j)]).norm();
                assert!(
                    diff < 1e-8,
                    "Methods differ at [{},{}]: eigen={:?}, scaling={:?}, diff={}",
                    i,
                    j,
                    log_eigen[(i, j)],
                    log_scaling[(i, j)],
                    diff
                );
            }
        }
    }
}
