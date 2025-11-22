# mathjs feat/logm Update Notes

## Summary

Updated mathjs bundle to latest from https://github.com/jacksonloper/mathjs/tree/feat/logm (commit a3ebf61).

**Status: ⚠️ Tests Failing (8/32 failing)**

## Issue Found

The mathjs `feat/logm` implementation has a bug in the Schur decomposition that prevents `logm()` from working correctly on rotation matrices.

### Problem Details

The `math.schur()` function does not return a quasi-upper-triangular matrix as required by the Schur decomposition algorithm. For example:

```javascript
// Expected: T should be upper triangular (T[i,j] ≈ 0 for i > j)
// Actual: Large values below diagonal
T[1,0] = -0.380...  (should be ≈0)
T[2,0] = 0.924...   (should be ≈0) ← Major issue!
T[2,1] = -0.382...  (should be ≈0)
```

This causes:
1. `rsf2csf()` (Real Schur Form → Complex Schur Form) to fail at producing triangular output
2. `logm_triu()` to throw "Matrix must be upper triangular" error
3. `logm()` to fail on rotation matrices

### Test Case

Run `node schur-bug-test.js` to see the bug in action.

### Failing Tests

```
✗ Geodesic Distance Functions > logUnitary > should handle 3D rotation matrices
✗ Geodesic Distance Functions > geodesicDistance > should be finite for different rotations
✗ Geodesic Distance Functions > geodesicDistance > should be symmetric
✗ Geodesic Distance Functions > geodesicDistanceArray > should match mathjs version
✗ Geodesic Distance Functions > dGeodesicAtZero > should give consistent results...
✗ Geodesic Distance Functions > dGeodesicAtZero > should work with different swivel directions
✗ Geodesic Distance Functions > Geodesic Interpolation > should give halfway point at t=0.5...
✗ Geodesic Distance Functions > Geodesic Interpolation > should produce valid rotation matrices
```

All failures are due to the same root cause: `math.schur()` not producing proper triangular form.

## Next Steps

This needs to be fixed in the upstream mathjs feat/logm branch. The Schur decomposition implementation needs to be debugged to ensure it produces quasi-upper-triangular matrices for all inputs, especially rotation/orthogonal matrices.

## Files Changed

- `.dependencies/mathjs-15.1.0.tgz` - Updated mathjs bundle
- `package-lock.json` - Updated after reinstalling dependencies
- `schur-bug-test.js` - Test case demonstrating the bug
