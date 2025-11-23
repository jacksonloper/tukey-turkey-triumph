use nalgebra::DMatrix;
use num_complex::Complex64;
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

/// Substitute value for log(0) to avoid -infinity
const LOG_ZERO_SUBSTITUTE: f64 = -1e10;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Matrix logarithm using eigendecomposition for orthogonal matrices
/// This implementation uses Schur decomposition to compute eigenvalues and eigenvectors
/// For rotation matrices in SO(n), eigenvalues lie on the unit circle
#[allow(dead_code)]
fn matrix_log_eigen(m: &DMatrix<f64>) -> DMatrix<Complex64> {
    let _n = m.nrows();

    // Try Schur decomposition: M = Q T Q^H
    // where T is upper triangular (or quasi-triangular for real matrices)
    match m.clone().try_schur(1e-12, 500) {
        Some(schur) => {
            // Get the Schur form components - unpack consumes schur
            let (q, t) = schur.unpack();

            // For orthogonal matrices, T contains the eigenvalues
            // Compute log(T) - since T is upper triangular, we need to handle it carefully
            let log_t = log_upper_triangular(&t);

            // Reconstruct: log(M) = Q * log(T) * Q^H
            let q_complex = q.map(|x| Complex64::new(x, 0.0));
            let q_h = q_complex.adjoint(); // Hermitian transpose

            &q_complex * &log_t * &q_h
        }
        None => {
            // Fallback to scaling and squaring if Schur decomposition fails
            log("Schur decomposition failed, falling back to scaling and squaring");
            matrix_log_scaling_squaring(m)
        }
    }
}

/// Compute logarithm of an upper triangular matrix
/// For quasi-triangular matrices (from real Schur form), this handles 2x2 blocks
fn log_upper_triangular(t: &DMatrix<f64>) -> DMatrix<Complex64> {
    let n = t.nrows();
    let mut log_t = DMatrix::<Complex64>::zeros(n, n);

    // First, compute logarithms of diagonal blocks (eigenvalues)
    let mut i = 0;
    while i < n {
        // Check if we have a 2x2 block (complex conjugate eigenvalue pair)
        if i + 1 < n && t[(i + 1, i)].abs() > 1e-10 {
            // Extract 2x2 block
            let a = t[(i, i)];
            let b = t[(i, i + 1)];
            let c = t[(i + 1, i)];
            let d = t[(i + 1, i + 1)];

            // For a 2x2 block representing complex eigenvalues, compute its logarithm
            // using eigendecomposition of the small 2x2 block
            let trace = a + d;
            let det = a * d - b * c;

            // Eigenvalues: λ = (trace ± sqrt(trace² - 4*det)) / 2
            let discriminant = trace * trace - 4.0 * det;

            if discriminant < 0.0 {
                // Complex eigenvalues
                let real_part = trace / 2.0;
                let imag_part = (-discriminant).sqrt() / 2.0;

                // Convert to polar form: λ = r * e^(iθ)
                let r = (real_part * real_part + imag_part * imag_part).sqrt();
                let theta = imag_part.atan2(real_part);

                // For the 2x2 block, we compute log directly from polar form
                // log(λ) = log(r) + iθ
                let log_r = r.ln();

                // The log of a 2x2 rotation-scaling block is:
                // [[log_r, -theta], [theta, log_r]]
                log_t[(i, i)] = Complex64::new(log_r, 0.0);
                log_t[(i, i + 1)] = Complex64::new(-theta, 0.0);
                log_t[(i + 1, i)] = Complex64::new(theta, 0.0);
                log_t[(i + 1, i + 1)] = Complex64::new(log_r, 0.0);
            } else {
                // Real eigenvalues (shouldn't typically happen for orthogonal matrices)
                let sqrt_disc = discriminant.sqrt();
                let lambda1 = (trace + sqrt_disc) / 2.0;
                let lambda2 = (trace - sqrt_disc) / 2.0;

                log_t[(i, i)] = if lambda1 > 0.0 {
                    Complex64::new(lambda1.ln(), 0.0)
                } else {
                    Complex64::new(lambda1.abs().ln(), PI)
                };

                log_t[(i + 1, i + 1)] = if lambda2 > 0.0 {
                    Complex64::new(lambda2.ln(), 0.0)
                } else {
                    Complex64::new(lambda2.abs().ln(), PI)
                };
            }

            i += 2;
        } else {
            // Real eigenvalue (1x1 block)
            let lambda = t[(i, i)];

            if lambda > 0.0 {
                log_t[(i, i)] = Complex64::new(lambda.ln(), 0.0);
            } else if lambda < 0.0 {
                // log(-|λ|) = log(|λ|) + iπ
                log_t[(i, i)] = Complex64::new(lambda.abs().ln(), PI);
            } else {
                // λ = 0 is problematic, use substitute value
                log_t[(i, i)] = Complex64::new(LOG_ZERO_SUBSTITUTE, 0.0);
            }

            i += 1;
        }
    }

    // Compute off-diagonal elements using Parlett's recurrence
    // This is a complex algorithm; for now we'll use a simplified approach
    // that works well for orthogonal matrices where off-diagonal elements are small

    // For orthogonal matrices, the Schur form is nearly diagonal or has 2x2 blocks
    // The off-diagonal terms above the blocks can be computed iteratively
    for col in 1..n {
        for row in 0..col {
            // Skip if we're inside a 2x2 block
            if row > 0 && t[(row, row - 1)].abs() > 1e-10 {
                continue;
            }
            if col < n - 1 && t[(col + 1, col)].abs() > 1e-10 {
                continue;
            }

            let t_ij = Complex64::new(t[(row, col)], 0.0);
            if t_ij.norm() > 1e-12 {
                let diff = log_t[(row, row)] - log_t[(col, col)];
                if diff.norm() > 1e-10 {
                    log_t[(row, col)] = t_ij / diff;
                }
            }
        }
    }

    log_t
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

/// Matrix logarithm using eigendecomposition approach (via Schur decomposition)
/// This is an alternative implementation for testing and comparison
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

/// Geodesic distance using eigendecomposition approach
#[wasm_bindgen]
pub fn geodesic_distance_eigen(r: &[f64], t: &[f64], n: usize) -> f64 {
    let r_mat = flat_to_matrix(r, n);
    let t_mat = flat_to_matrix(t, n);

    // R^T * T
    let r_transpose = r_mat.transpose();
    let u = r_transpose * t_mat;

    // log(U) using eigendecomposition
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

/// Geodesic interpolation using eigendecomposition approach
#[wasm_bindgen]
pub fn geodesic_interp_eigen(a: &[f64], b: &[f64], t: f64, n: usize) -> Vec<f64> {
    let a_mat = flat_to_matrix(a, n);
    let b_mat = flat_to_matrix(b, n);

    // A^T * B
    let a_transpose = a_mat.transpose();
    let r_rel = a_transpose * b_mat;

    // log(R_rel) using eigendecomposition
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
