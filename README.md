# Tukey's Turkey Triumph 🦃

Navigate R⁴ using Tukey's scatterplot matrix (the draughtsman's display) and pardon turkeys. You move; the grid stays world‑aligned; the player stays centered.

## Overview

- Hold W to move forward in your current 4D orientation
- Hold on any off‑diagonal cell (i, j) to rotate the current basis in the (i, j) plane (swapping i/j reverses direction)
- Reach the turkey to pardon it; a new one spawns elsewhere

## Historical Context

The scatterplot matrix—what John Tukey called the draughtsman's display—shows all pairwise projections of multivariate data in a tidy grid. The idea influenced a generation of exploratory graphics and clustering work, including J. A. Hartigan’s early computational graphics.

Key references:
- Tukey & Tukey (1981), exploratory graphics overviews
- Hartigan (1975), “Printer Graphics for Clustering” — original paper link: https://scholar.google.com/scholar?q=Hartigan+Printer+Graphics+for+Clustering+1975
- Chambers et al. (1983), Graphical Methods for Data Analysis

## Game Mechanics

### The 4D Universe
- You exist in 4D Euclidean space (R⁴)
- The grid is fixed to the world (cardinal axes); your dot stays centered and moves relative to it
- Exactly one turkey is active at a time; on contact it’s pardoned and another appears

### Visualization
The game displays a **4×4 scatterplot matrix** showing all pairwise projections:
```
        Dim 1   Dim 2   Dim 3   Dim 4
Dim 1    —      1-2     1-3     1-4
Dim 2   2-1      —      2-3     2-4
Dim 3   3-1     3-2      —      3-4
Dim 4   4-1     4-2     4-3      —
```

Each cell shows:
- Your position (blue dot)
- Turkeys (turkey icons)
- Pardoned turkeys (gold medal icons)

### Controls

**Movement:**
- W (or button): move forward; no reverse

**Rotation:**
- Hold on a plot (i, j): rotate the current basis in the (i, j) plane
- (i, j) vs (j, i) rotate in opposite directions

### Objective
Get within pardon range to award a medal. Keep going; new turkeys keep spawning.

## Technical Stack

- **Vanilla JavaScript**: No frameworks, pure performance
- **HTML5 Canvas**: For rendering the scatterplot matrix
- **Build System**: Vite (via npx) for development and production builds
- **Static Deployment**: Can be hosted anywhere (GitHub Pages, Netlify, Vercel, etc.)

## Project Structure

```
tukeys-turkey-triumph/
├── src/
│   ├── main.js           # Entry point
│   ├── game.js           # Game state and logic
│   ├── math4d.js         # 4D mathematics (torus, rotation)
│   ├── scatterplot.js    # Scatterplot matrix rendering
│   ├── turkey.js         # Turkey AI (Ornstein-Uhlenbeck)
│   └── style.css         # Styling
├── index.html            # Main HTML
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
- 4D rotations operate in one of six planes (i, j). We apply rotations in the current local basis; swapping (i, j) flips direction.

## Credits
- Inspired by John W. Tukey’s exploratory data analysis
- J. A. Hartigan’s early cluster graphics (“Printer Graphics for Clustering,” 1975)
- Thanksgiving meets multidimensional geometry

## License

MIT

---

*"The greatest value of a picture is when it forces us to notice what we never expected to see."* — John W. Tukey
