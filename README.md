# Rotation Matching Challenge 🔄

Master rotations in SO(n) by aligning curves through Tukey's scatterplot matrix (the draughtsman's display). See all pairwise projections simultaneously as you search for the hidden rotation.  See live [here](https://jacksonloper.github.io/tukey-turkey-triumph/).

## Overview

- Two curves are displayed: one fixed (orange) and one rotated by a secret rotation matrix (cyan)
- Hold on any off-diagonal cell (i, j) to rotate your basis in that plane
- Align the cyan curve with the orange curve by finding the correct rotation
- Choose from 2D to 5D spaces and different visualization modes

## Display Modes

The challenge offers four visualization modes to help you see correspondences between curves:

- **Vanilla**: Solid colors (orange and cyan) - the classic view
- **Rainbow**: Gradient colors along arclength showing how points correspond
- **Numbered**: Six numbered dots along each path to track specific points
- **Squirrel**: Animated markers that move in sync along both curves

The grid overlay is optional and off by default—toggle it to see the world-aligned coordinate system.

## Historical Context

The scatterplot matrix—what John Tukey called the draughtsman's display—shows all pairwise projections of multivariate data in a tidy grid. The idea influenced a generation of exploratory graphics and clustering work, including J. A. Hartigan's early computational graphics.

Key references:
- Tukey & Tukey (1981), exploratory graphics overviews
- Hartigan (1975), "Printer Graphics for Clustering" — original paper link: https://scholar.google.com/scholar?q=Hartigan+Printer+Graphics+for+Clustering+1975
- Chambers et al. (1983), Graphical Methods for Data Analysis

## Challenge Mechanics

### The Goal
- A smooth curve is generated on the sphere S^(n-1) (or inside the ball for 2D)
- The curve is randomly rotated by a matrix R sampled from SO(n) using the Haar measure
- You control a rotation matrix Q by applying incremental plane rotations
- When Q = R, the curves align perfectly and you win!

### Mathematical Structure
At each moment, you control an orientation matrix Q ∈ SO(n). The cyan curve transforms as Q^T R γ(t), where γ(t) is the original path and R is the secret target rotation. When your rotation Q matches R, the product Q^T R becomes the identity matrix I, and the curves align.

### Visualization
The display shows an **n×n scatterplot matrix** with all pairwise projections:
```
        Dim 1   Dim 2   Dim 3   Dim 4
Dim 1    —      1-2     1-3     1-4
Dim 2   2-1      —      2-3     2-4
Dim 3   3-1     3-2      —      3-4
Dim 4   4-1     4-2     4-3      —
```

Each cell shows:
- The orange curve (fixed reference)
- The cyan curve (rotates with your orientation)
- Optional grid overlay showing world coordinates

### Controls

**Rotation:**
- Hold on a plot (i, j): rotate the current basis in the (i, j) plane
- (i, j) vs (j, i) rotate in opposite directions

**Auto-Rotate:**
- Click "Auto-Rotate" to move halfway toward the solution

**New Challenge:**
- Click "New Challenge" to generate a fresh random rotation

## Technical Stack

- **Vanilla JavaScript**: No frameworks, pure performance
- **HTML5 Canvas**: For rendering the scatterplot matrix
- **Build System**: Vite for development and production builds
- **Static Deployment**: Can be hosted anywhere (GitHub Pages, Netlify, Vercel, etc.)

## Project Structure

```
tukeys-turkey-triumph/
├── src/
│   ├── rotation-challenge-main.js  # Entry point
│   ├── rotation-challenge.js       # Challenge logic
│   ├── math4d.js                   # N-D mathematics (rotations, SO(n))
│   ├── scatterplot.js              # Scatterplot matrix rendering
│   ├── sphere-path.js              # Path generation and rotation
│   └── style.css                   # Styling
├── index.html                      # Main HTML
├── package.json
└── README.md
```

## Installation

```bash
# Development server
npm install
npm run dev

# Production build
npm run build
npm run preview
```

## Mathematical Notes
- N-dimensional rotations operate in planes (i, j). We apply rotations in the current local basis; swapping (i, j) flips direction.
- The rotation distance metric uses the Frobenius norm: ||R^T Q - I||_F
- Random rotations are sampled using QR decomposition of Gaussian matrices (Haar measure)

### Geodesic Distance on SO(n)

The repository now includes proper geodesic distance calculations using matrix logarithm:

```javascript
import { geodesicDistanceArray, dGeodesicAtZeroArray } from './src/math4d.js';

// Compute geodesic distance between two rotation matrices
const distance = geodesicDistanceArray(R1, R2);

// Compute derivative of distance with respect to a swivel parameter
// K is a skew-symmetric generator matrix
const derivative = dGeodesicAtZeroArray(R, T, K);
```

The geodesic distance is computed as:
```
d(R, T) = || log(R^* T) ||_F
```

where `log` is the matrix logarithm for unitary/orthogonal matrices, computed using the inverse scaling and squaring method with Taylor series expansion.

The derivative function computes:
```
d/dε [d(H(ε), T)]_{ε=0}  where  H(ε) = R exp(ε K)
```

This uses central finite differences for numerical differentiation. See `src/geodesic-example.js` for usage examples.

**Dependencies:** The geodesic functions use a fork of `mathjs` with `logm` (matrix logarithm) support, included as a local dependency.

## Credits
- Inspired by John W. Tukey's exploratory data analysis
- J. A. Hartigan's early cluster graphics ("Printer Graphics for Clustering," 1975)
- Special Operations group SO(n) and the geometry of rotations

## License

MIT

---

*"The greatest value of a picture is when it forces us to notice what we never expected to see."* — John W. Tukey
