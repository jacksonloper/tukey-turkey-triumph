/**
 * Scatterplot Matrix (Draughtsman's Display) Renderer
 * Displays all pairwise projections of N-D data
 */

import { matVecMult, matVecMultN, transpose, transposeN } from './math4d.js';

export class ScatterplotMatrix {
  constructor(canvas, dimensions = 4) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dimensions = dimensions;
    this.cellSize = 0;
    this.padding = 40;
    this.cellPadding = 10;

    // Mobile view settings
    this.mobileViewEnabled = false;
    
    // Rotation direction for mobile controls (1 = clockwise, -1 = counterclockwise)
    this.rotationDirection = 1;

    // World-grid rendering settings (cardinal basis)
    this.gridSpacing = 2.0; // world units between grid lines (half as many)
    this.gridRange = 4.0;   // cover initial field of view [-4,4]
    this.gridColor = 'rgba(100, 108, 255, 0.28)';
    this.gridZeroColor = 'rgba(100, 108, 255, 0.60)';
    this.gridLineWidth = 1.5;
    this.gridBoundaryColor = 'rgba(100, 108, 255, 0.85)';
    this.gridBoundaryLineWidth = 2.5;

    // Precomputed world grid lines (pairs of 4D endpoints)
    this._gridLinesWorld = null;

    // Click handling
    this.clickCallbacks = [];

    // Mouse hold handling for continuous rotation
    this.isMouseDown = false;
    this.holdDims = null; // [dimI, dimJ] being held

    // Improve touch behavior on mobile
    this.canvas.style.touchAction = 'none';

    // Set up canvas
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Handle unified pointer events (works on mouse + touch)
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e), { passive: false });
    this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
  }

  setMobileViewEnabled(enabled) {
    this.mobileViewEnabled = enabled;
    
    // Get container elements
    const mobileContainer = document.getElementById('mobile-grid-container');
    
    if (enabled) {
      // Hide main canvas, show mobile grid
      this.canvas.style.display = 'none';
      if (mobileContainer) {
        mobileContainer.style.display = 'block';
        this.setupMobileGrid();
      }
    } else {
      // Show main canvas, hide mobile grid
      this.canvas.style.display = 'block';
      if (mobileContainer) {
        mobileContainer.style.display = 'none';
        this.clearMobileGrid();
      }
      this.resize();
    }
  }

  /**
   * Set up the mobile grid with separate canvases
   */
  setupMobileGrid() {
    const container = document.getElementById('mobile-grid-container');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Get all off-diagonal pairs where i < j (upper triangle only)
    const pairs = [];
    for (let row = 0; row < this.dimensions; row++) {
      for (let col = 0; col < this.dimensions; col++) {
        if (row < col) {  // Only show pairs where i < j
          pairs.push([row, col]);
        }
      }
    }

    // Store canvas references for rendering
    this.mobileCanvases = [];

    // Create a row for each pair
    pairs.forEach((pair, index) => {
      const [row, col] = pair;
      
      // Create row container
      const rowDiv = document.createElement('div');
      rowDiv.className = 'mobile-grid-row';
      
      // Create target cell (left - shows orange fixed curve)
      const targetCell = this.createMobileCell(row, col, 'target');
      
      // Add (i,j) label to target cell (after canvas, at bottom)
      const coordLabelDiv = document.createElement('div');
      coordLabelDiv.className = 'mobile-grid-label';
      coordLabelDiv.textContent = `(${row + 1}, ${col + 1})`;
      targetCell.container.appendChild(coordLabelDiv);
      
      rowDiv.appendChild(targetCell.container);
      
      // Create current cell (right - shows cyan rotating curve)
      const currentCell = this.createMobileCell(row, col, 'current');
      rowDiv.appendChild(currentCell.container);
      
      container.appendChild(rowDiv);
      
      // Store canvas references
      this.mobileCanvases.push({
        dims: [row, col],
        targetCanvas: targetCell.canvas,
        targetCtx: targetCell.ctx,
        currentCanvas: currentCell.canvas,
        currentCtx: currentCell.ctx
      });
    });
  }

  /**
   * Create a mobile cell with its own canvas
   */
  createMobileCell(row, col, mode) {
    const cellDiv = document.createElement('div');
    cellDiv.className = 'mobile-grid-cell';
    
    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'mobile-canvas-container';
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (will be adjusted in render)
    const size = 200; // Base size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Scale context for DPR
    ctx.scale(dpr, dpr);
    
    canvasContainer.appendChild(canvas);
    cellDiv.appendChild(canvasContainer);
    
    // Add rotation controls below canvas only for current cells
    if (mode === 'current') {
      // Shared reset function for rotation state
      const resetRotation = () => {
        this.isMouseDown = false;
        this.holdDims = null;
        this.rotationDirection = 1;
      };
      
      // Create rotation button container (below canvas)
      const rotationControls = document.createElement('div');
      rotationControls.className = 'mobile-rotation-controls';
      
      // Counterclockwise button
      const ccwButton = document.createElement('button');
      ccwButton.className = 'mobile-rotation-btn ccw';
      ccwButton.innerHTML = '↺ CCW';
      ccwButton.title = 'Rotate counterclockwise';
      ccwButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isMouseDown = true;
        this.holdDims = [row, col];
        this.rotationDirection = -1; // Counterclockwise
        this.clickCallbacks.forEach(cb => cb(row, col));
      }, { passive: false });
      
      ccwButton.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetRotation();
      });
      
      ccwButton.addEventListener('pointerleave', resetRotation);
      
      // Clockwise button
      const cwButton = document.createElement('button');
      cwButton.className = 'mobile-rotation-btn cw';
      cwButton.innerHTML = '↻ CW';
      cwButton.title = 'Rotate clockwise';
      cwButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isMouseDown = true;
        this.holdDims = [row, col];
        this.rotationDirection = 1; // Clockwise
        this.clickCallbacks.forEach(cb => cb(row, col));
      }, { passive: false });
      
      cwButton.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetRotation();
      });
      
      cwButton.addEventListener('pointerleave', resetRotation);
      
      rotationControls.appendChild(ccwButton);
      rotationControls.appendChild(cwButton);
      cellDiv.appendChild(rotationControls);
    }
    
    return { container: cellDiv, canvas, ctx };
  }

  /**
   * Clear the mobile grid
   */
  clearMobileGrid() {
    const container = document.getElementById('mobile-grid-container');
    if (container) {
      container.innerHTML = '';
    }
    this.mobileCanvases = [];
  }

  resize() {
    // Skip resize for mobile view (each canvas manages its own size)
    if (this.mobileViewEnabled) {
      return;
    }

    // Calculate available width dynamically based on viewport
    // Mobile (< 600px): app padding 0.5rem, play-area padding 8px, border 2px
    // Desktop: app padding 1rem, play-area padding 12px, border 2px
    const isMobile = window.innerWidth < 600;
    const appPadding = isMobile ? 16 : 32; // 0.5rem or 1rem * 2 sides
    const playAreaPadding = isMobile ? 16 : 24; // 8px or 12px * 2 sides
    const playAreaBorder = 4; // 2px * 2 sides
    const totalPadding = appPadding + playAreaPadding + playAreaBorder;

    // Normal grid view
    const size = Math.min(800, window.innerWidth - totalPadding);
    const height = size;

    // Account for device pixel ratio for high-DPI displays
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal resolution (scaled by DPR)
    this.canvas.width = size * dpr;
    this.canvas.height = height * dpr;

    // Set canvas CSS size (display size)
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = height + 'px';

    // IMPORTANT: Reset transform before scaling to avoid compounding
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Scale context to match DPR
    this.ctx.scale(dpr, dpr);

    // Store the display size for calculations
    this.displaySize = size;
    this.displayHeight = height;
    this.cellSize = (size - this.padding * 2) / this.dimensions;
  }

  /**
   * Register a callback for when a scatterplot is clicked
   * Callback receives (dimI, dimJ)
   */
  onPlotClick(callback) {
    this.clickCallbacks.push(callback);
  }

  /**
   * Register a callback for when a diagonal is clicked
   * Callback receives (dim) - the dimension to move along
   */
  onDiagonalClick(callback) {
    if (!this.diagonalCallbacks) {
      this.diagonalCallbacks = [];
    }
    this.diagonalCallbacks.push(callback);
  }

  getCellFromMouse(e) {
    // Mobile view uses separate canvases with their own event handlers
    // This method is only used for normal grid mode
    if (this.mobileViewEnabled) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    // Convert from screen coordinates to canvas display coordinates
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normal grid mode
    // Determine which cell was clicked (using display size, not internal canvas size)
    const col = Math.floor((x - this.padding) / this.cellSize);
    const row = Math.floor((y - this.padding) / this.cellSize);

    if (col >= 0 && col < this.dimensions && row >= 0 && row < this.dimensions) {
      if (row === col) {
        return { diagonal: true, dim: row };
      } else {
        return { diagonal: false, dims: [row, col] };
      }
    }
    return null;
  }

  handlePointerDown(e) {
    // In mobile view, canvases don't handle pointer events
    // (only buttons do), so allow scrolling
    if (this.mobileViewEnabled) {
      return;
    }
    
    // Prevent scrolling/zoom while interacting
    if (e.cancelable) e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    const cell = this.getCellFromMouse(e);
    if (cell) {
      if (cell.diagonal) {
        // Diagonal clicked - move along that dimension
        if (this.diagonalCallbacks) {
          this.diagonalCallbacks.forEach(cb => cb(cell.dim));
        }
      } else {
        // Off-diagonal clicked - rotate
        this.isMouseDown = true;
        this.holdDims = cell.dims;
        // Trigger initial rotation
        this.clickCallbacks.forEach(cb => cb(cell.dims[0], cell.dims[1]));
      }
    }
  }

  handlePointerUp(e) {
    // In mobile view, canvases don't handle pointer events
    if (this.mobileViewEnabled) {
      return;
    }
    
    this.isMouseDown = false;
    this.holdDims = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch {}
  }

  /**
   * Check if we should trigger continuous rotation
   */
  checkContinuousRotation() {
    if (this.isMouseDown && this.holdDims) {
      return this.holdDims;
    }
    return null;
  }

  /**
   * Render the complete scatterplot matrix
   */
  render(player, turkeys, ui = {}) {
    const ctx = this.ctx;
    // Use displaySize instead of canvas.width/height (which are DPR-scaled)
    const width = this.displaySize;
    const height = this.displaySize;

    // Clear with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Transform all positions to player's oriented frame (origin-fixed view)
    // Rotate world coordinates by inverse orientation; do not center on player
    const orientationInverse = transposeN(player.orientation);
    this._orientationInverse = orientationInverse;
    this._playerWorld = player.position;

    const playerLocal = matVecMultN(orientationInverse,
      player.position.map((v, i) => v - player.position[i])
    ); // always [0,0,0,...,0]

    // Transform turkeys to oriented frame, centered on player (so dot is centered)
    const turkeysLocal = turkeys.map(turkey => {
      const relativePos = turkey.position.map((v, i) => v - player.position[i]);
      const localPos = matVecMultN(orientationInverse, relativePos);

      // Transform head and nose positions to local frame as well
      let headPosLocal = null;
      let nosePosLocal = null;
      if (turkey.headOffset && turkey.noseOffset) {
        const headWorldPos = turkey.position.map((v, i) => v + turkey.headOffset[i]);
        const noseWorldPos = turkey.position.map((v, i) => v + turkey.noseOffset[i]);

        const headRelative = headWorldPos.map((v, i) => v - player.position[i]);
        const noseRelative = noseWorldPos.map((v, i) => v - player.position[i]);

        headPosLocal = matVecMultN(orientationInverse, headRelative);
        nosePosLocal = matVecMultN(orientationInverse, noseRelative);
      }

      return {
        position: localPos,
        headPosLocal: headPosLocal,
        nosePosLocal: nosePosLocal,
        pardoned: turkey.pardoned,
        scale: turkey.scale,
        rotation: turkey.rotation,
        hue: turkey.hue
      };
    });

    // Transform trail to oriented frame, centered on player
    const trailLocal = ui.trail && ui.trailEnabled ? ui.trail.map(crumbPos => {
      const relativePos = crumbPos.map((v, i) => v - player.position[i]);
      return matVecMultN(orientationInverse, relativePos);
    }) : [];

    // Transform paths to oriented frame (for rotation challenge)
    // Some paths can be marked as "fixed" to stay in world coordinates
    const pathsLocal = ui.paths ? ui.paths.map(pathData => {
      if (pathData.fixed) {
        // Fixed paths: don't transform by player orientation
        return {
          points: pathData.points.map(point => point.map((v, i) => v - player.position[i])),
          color: pathData.color,
          label: pathData.label,
          numbered: pathData.numbered,
          numDots: pathData.numDots,
          squirrel: pathData.squirrel,
          progress: pathData.progress,
          arcLengths: pathData.arcLengths,
          fixed: true  // IMPORTANT: Preserve the fixed property!
        };
      } else {
        // Rotating paths: transform by player orientation
        return {
          points: pathData.points.map(point => {
            const relativePos = point.map((v, i) => v - player.position[i]);
            return matVecMultN(orientationInverse, relativePos);
          }),
          color: pathData.color,
          label: pathData.label,
          numbered: pathData.numbered,
          numDots: pathData.numDots,
          squirrel: pathData.squirrel,
          progress: pathData.progress,
          arcLengths: pathData.arcLengths,
          fixed: false  // IMPORTANT: Preserve the fixed property!
        };
      }
    }) : [];

    // Choose rendering mode
    if (this.mobileViewEnabled) {
      this.renderMobileView(playerLocal, turkeysLocal, ui, trailLocal, pathsLocal);
    } else {
      // Draw each cell in the matrix
      for (let row = 0; row < this.dimensions; row++) {
        for (let col = 0; col < this.dimensions; col++) {
          this.renderCell(row, col, playerLocal, turkeysLocal, ui, trailLocal, pathsLocal);
        }
      }

      // Draw grid and labels
      this.drawGrid();
      this.drawLabels();
    }
  }

  /**
   * Render mobile view: each (i,j) pair with separate target and current canvases
   */
  renderMobileView(playerLocal, turkeysLocal, ui, trailLocal, pathsLocal) {
    if (!this.mobileCanvases || this.mobileCanvases.length === 0) {
      return;
    }

    // Render each pair of canvases
    this.mobileCanvases.forEach(canvasInfo => {
      const [dimI, dimJ] = canvasInfo.dims;
      
      // Render target canvas (fixed paths - orange)
      this.renderSingleMobileCanvas(
        canvasInfo.targetCanvas,
        canvasInfo.targetCtx,
        dimI, dimJ,
        playerLocal, turkeysLocal, ui, trailLocal, pathsLocal,
        'target'
      );
      
      // Render current canvas (rotating paths - cyan)
      this.renderSingleMobileCanvas(
        canvasInfo.currentCanvas,
        canvasInfo.currentCtx,
        dimI, dimJ,
        playerLocal, turkeysLocal, ui, trailLocal, pathsLocal,
        'current'
      );
    });
  }

  /**
   * Render a single mobile canvas (either target or current)
   */
  renderSingleMobileCanvas(canvas, ctx, dimI, dimJ, playerLocal, turkeysLocal, ui, trailLocal, pathsLocal, mode) {
    // Get canvas dimensions
    const width = 200; // Base display size
    const height = 200;
    const padding = 10;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding, padding, innerWidth, innerHeight);

    // Draw world-aligned fixed grid (only if showGrid is true)
    if (ui.showGrid !== false) {
      this.drawWorldGridSeparate(ctx, padding, padding, innerWidth, innerHeight, dimI, dimJ);
    }

    // Filter paths based on mode
    const filteredPaths = pathsLocal.filter(pathData => {
      if (mode === 'target') {
        return pathData.fixed; // Show only fixed (orange) paths
      } else {
        return !pathData.fixed; // Show only rotating (cyan) paths
      }
    });

    // Draw paths
    filteredPaths.forEach(pathData => {
      this.drawPathSeparate(ctx, padding, padding, innerWidth, innerHeight, pathData, dimI, dimJ);
    });

    // Draw player (if enabled, typically not shown in rotation challenge)
    if (ui.showPlayer !== false) {
      this.drawPlayerSeparate(ctx, padding, padding, innerWidth, innerHeight, playerLocal, dimI, dimJ, ui);
    }
  }

  /**
   * Draw world grid in separate canvas
   */
  drawWorldGridSeparate(ctx, cellX, cellY, cellWidth, cellHeight, dimI, dimJ) {
    const viewRange = this.gridRange;

    // Clip to the inner plotting area
    ctx.save();
    ctx.beginPath();
    ctx.rect(cellX, cellY, cellWidth, cellHeight);
    ctx.clip();

    const Rinv = this._orientationInverse;
    const P = this._playerWorld;

    if (!this._gridLinesWorld) this.buildWorldGridLines();

    // Draw every precomputed world line
    for (const line of this._gridLinesWorld) {
      const a = line.a, b = line.b;
      // Transform to oriented frame (Rinv * (world - P))
      const la = matVecMultN(Rinv, a.map((v, i) => v - P[i]));
      const lb = matVecMultN(Rinv, b.map((v, i) => v - P[i]));

      // Quick reject: both endpoints outside on same side in either dim
      const aI = la[dimI], bI = lb[dimI];
      const aJ = la[dimJ], bJ = lb[dimJ];
      const R = viewRange;
      if ((aI < -R && bI < -R) || (aI > R && bI > R) || (aJ < -R && bJ < -R) || (aJ > R && bJ > R)) {
        continue;
      }

      const px1 = cellX + ((aJ / viewRange) + 1) * cellWidth / 2;
      const py1 = cellY + (1 - ((aI / viewRange) + 1) / 2) * cellHeight;
      const px2 = cellX + ((bJ / viewRange) + 1) * cellWidth / 2;
      const py2 = cellY + (1 - ((bI / viewRange) + 1) / 2) * cellHeight;

      const isAxis = line.isAxis;
      ctx.strokeStyle = isAxis ? this.gridZeroColor : this.gridColor;
      ctx.lineWidth = isAxis ? this.gridLineWidth * 1.5 : this.gridLineWidth;
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }

    // Emphasize world boundary of the fixed box at +/- viewRange along both dims
    const drawBoundaryLine = (fixDim, fixVal, varyDim) => {
      const a = new Array(this.dimensions).fill(0);
      const b = new Array(this.dimensions).fill(0);
      a[fixDim] = fixVal;
      b[fixDim] = fixVal;
      a[varyDim] = -viewRange;
      b[varyDim] = +viewRange;
      const la = matVecMultN(Rinv, a.map((v, i) => v - P[i]));
      const lb = matVecMultN(Rinv, b.map((v, i) => v - P[i]));
      // Map using the cell axes: x uses dimJ, y uses dimI
      const x1 = cellX + ((la[dimJ] / viewRange) + 1) * cellWidth / 2;
      const y1 = cellY + (1 - ((la[dimI] / viewRange) + 1) / 2) * cellHeight;
      const x2 = cellX + ((lb[dimJ] / viewRange) + 1) * cellWidth / 2;
      const y2 = cellY + (1 - ((lb[dimI] / viewRange) + 1) / 2) * cellHeight;
      ctx.strokeStyle = this.gridBoundaryColor;
      ctx.lineWidth = this.gridBoundaryLineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    drawBoundaryLine(dimI, -viewRange, dimJ);
    drawBoundaryLine(dimI, +viewRange, dimJ);
    drawBoundaryLine(dimJ, -viewRange, dimI);
    drawBoundaryLine(dimJ, +viewRange, dimI);

    ctx.restore();
  }

  /**
   * Draw path in separate canvas
   */
  drawPathSeparate(ctx, cellX, cellY, cellWidth, cellHeight, pathData, dimI, dimJ) {
    const viewRange = this.gridRange;

    const { points, color, numbered, numDots = 6, squirrel, progress = 0, arcLengths } = pathData;

    // Helper to project point to screen coordinates
    const projectPoint = (point) => {
      const px = cellX + (point[dimJ] / viewRange + 1) * cellWidth / 2;
      const py = cellY + (1 - (point[dimI] / viewRange + 1) / 2) * cellHeight;
      return [px, py];
    };

    // Rainbow mode
    if (color === 'rainbow') {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < points.length - 1; i++) {
        const t = i / (points.length - 1);
        const hue = t * 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        
        const [px1, py1] = projectPoint(points[i]);
        const [px2, py2] = projectPoint(points[i + 1]);
        
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Numbered mode
    if (numbered) {
      ctx.save();
      
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      for (let n = 0; n < numDots; n++) {
        const idx = Math.floor(n * (points.length - 1) / (numDots - 1));
        const point = points[idx];
        const [px, py] = projectPoint(point);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((n + 1).toString(), px, py);
      }
      
      ctx.restore();
      return;
    }

    // Squirrel mode
    if (squirrel) {
      ctx.save();
      
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      let idx;
      if (arcLengths && arcLengths.length > 0) {
        const totalLength = arcLengths[arcLengths.length - 1];
        const targetLength = progress * totalLength;
        
        idx = 0;
        for (let i = 0; i < arcLengths.length - 1; i++) {
          if (arcLengths[i] <= targetLength && targetLength < arcLengths[i + 1]) {
            idx = i;
            break;
          }
        }
        if (targetLength >= totalLength - 0.001) {
          idx = points.length - 1;
        }
      } else {
        idx = Math.floor(progress * (points.length - 1));
      }
      
      const point = points[idx];
      const [px, py] = projectPoint(point);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(px - 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.arc(px + 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.restore();
      return;
    }

    // Vanilla mode
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let firstPoint = true;

    for (let i = 0; i < points.length; i++) {
      const [px, py] = projectPoint(points[i]);

      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw player in separate canvas
   */
  drawPlayerSeparate(ctx, cellX, cellY, cellWidth, cellHeight, playerLocal, dimI, dimJ, ui) {
    // Always draw at the center of the cell
    const px = cellX + cellWidth / 2;
    const py = cellY + cellHeight / 2;
    
    // Use existing drawPlayerSprite with the provided ctx
    const originalCtx = this.ctx;
    this.ctx = ctx;
    this.drawPlayerSprite(px, py, dimI, dimJ, ui);
    this.ctx = originalCtx;
  }

  /**
   * Draw path in mobile view cell (old single-canvas method, kept for normal grid mode)
   */
  drawPathMobile(cellX, cellY, cellWidth, cellHeight, pathData, dimI, dimJ) {
    const ctx = this.ctx;
    const viewRange = this.gridRange;

    const { points, color, numbered, numDots = 6, squirrel, progress = 0, arcLengths } = pathData;

    // Helper to project point to screen coordinates
    const projectPoint = (point) => {
      const px = cellX + (point[dimJ] / viewRange + 1) * cellWidth / 2;
      const py = cellY + (1 - (point[dimI] / viewRange + 1) / 2) * cellHeight;
      return [px, py];
    };

    // Rainbow mode
    if (color === 'rainbow') {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < points.length - 1; i++) {
        const t = i / (points.length - 1);
        const hue = t * 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        
        const [px1, py1] = projectPoint(points[i]);
        const [px2, py2] = projectPoint(points[i + 1]);
        
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Numbered mode
    if (numbered) {
      ctx.save();
      
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      for (let n = 0; n < numDots; n++) {
        const idx = Math.floor(n * (points.length - 1) / (numDots - 1));
        const point = points[idx];
        const [px, py] = projectPoint(point);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((n + 1).toString(), px, py);
      }
      
      ctx.restore();
      return;
    }

    // Squirrel mode
    if (squirrel) {
      ctx.save();
      
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      let idx;
      if (arcLengths && arcLengths.length > 0) {
        const totalLength = arcLengths[arcLengths.length - 1];
        const targetLength = progress * totalLength;
        
        idx = 0;
        for (let i = 0; i < arcLengths.length - 1; i++) {
          if (arcLengths[i] <= targetLength && targetLength < arcLengths[i + 1]) {
            idx = i;
            break;
          }
        }
        if (targetLength >= totalLength - 0.001) {
          idx = points.length - 1;
        }
      } else {
        idx = Math.floor(progress * (points.length - 1));
      }
      
      const point = points[idx];
      const [px, py] = projectPoint(point);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(px - 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.arc(px + 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.restore();
      return;
    }

    // Vanilla mode
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let firstPoint = true;

    for (let i = 0; i < points.length; i++) {
      const [px, py] = projectPoint(points[i]);

      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw player sprite at specified position
   * @param {number} px - X coordinate for player center
   * @param {number} py - Y coordinate for player center
   * @param {number} dimI - First dimension index
   * @param {number} dimJ - Second dimension index
   * @param {object} ui - UI state including shipType and forwardDir
   */
  drawPlayerSprite(px, py, dimI, dimJ, ui) {
    const ctx = this.ctx;

    if (ui.shipType === 'druuge') {
      // Druuge ship: elongated along dimension 0 (forward direction in local space)
      // If this cell involves dim 0, show elongated shape with cone; otherwise show square cross-section
      const f = ui.forwardDir || [1,0,0,0];
      const involvesDim0 = (dimI === 0 || dimJ === 0);

      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = 0.85; // Semi-transparent
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 2;

      if (involvesDim0) {
        // Elongated view: show cone-tipped shape oriented by forward direction
        const vx = f[dimJ] || 0;
        const vy = f[dimI] || 0;
        let ang = 0;
        if (Math.abs(vx) + Math.abs(vy) > 1e-6) {
          ang = Math.atan2(-vy, vx);
        }
        ctx.rotate(ang);

        // Draw cone-tipped ship (rectangle + triangle at front)
        const bodyLen = 12, bodyHeight = 8, coneLen = 6;
        ctx.beginPath();
        // Main body rectangle
        ctx.rect(-bodyLen/2, -bodyHeight/2, bodyLen, bodyHeight);
        ctx.fill();
        ctx.stroke();

        // Front cone
        ctx.beginPath();
        ctx.moveTo(bodyLen/2, -bodyHeight/2); // top of body
        ctx.lineTo(bodyLen/2 + coneLen, 0);    // cone tip
        ctx.lineTo(bodyLen/2, bodyHeight/2);   // bottom of body
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Cross-section view: show square (perpendicular to forward direction)
        const size = 8;
        ctx.beginPath();
        ctx.rect(-size/2, -size/2, size, size);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Aerilou: blue dot
      ctx.save();
      ctx.globalAlpha = 0.85; // Semi-transparent
      ctx.fillStyle = '#00d4ff';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw player in mobile view cell
   */
  drawPlayerMobile(cellX, cellY, cellWidth, cellHeight, playerLocal, dimI, dimJ, ui) {
    // Always draw at the center of the cell
    const px = cellX + cellWidth / 2;
    const py = cellY + cellHeight / 2;
    this.drawPlayerSprite(px, py, dimI, dimJ, ui);
  }

  /**
   * Render a single scatterplot cell
   */
  renderCell(row, col, playerLocal, turkeysLocal, ui, trailLocal = [], pathsLocal = []) {
    const ctx = this.ctx;
    const x = this.padding + col * this.cellSize;
    const y = this.padding + row * this.cellSize;

    // Draw cell background
    ctx.fillStyle = row === col ? '#1a1a1a' : '#000000';
    ctx.fillRect(x, y, this.cellSize, this.cellSize);

    // Diagonal cells show dimension label
    if (row === col) {
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`D${row + 1}`, x + this.cellSize / 2, y + this.cellSize / 2);
      return;
    }

    // Draw world-aligned fixed grid projected into this view (only if showGrid is true)
    if (ui.showGrid !== false) {
      this.drawWorldGrid(x, y, row, col);
    }

    // Draw axes
    this.drawAxes(x, y);

    // Draw paths (for rotation challenge)
    if (pathsLocal.length > 0) {
      pathsLocal.forEach(pathData => {
        this.drawPath(x, y, pathData, row, col);
      });
    }

    // Draw trail (behind everything else)
    if (trailLocal.length > 0) {
      this.drawTrail(x, y, trailLocal, row, col);
    }

    // Draw turkeys
    turkeysLocal.forEach(turkey => {
      this.drawTurkey(x, y, turkey, row, col);
    });

    // Draw player (unless explicitly disabled)
    if (ui.showPlayer !== false) {
      this.drawPlayer(x, y, playerLocal, row, col, ui);
    }

    // Draw thrust/torque puffs
    this.drawPuffs(x, y, row, col, ui);
  }

  // Build world grid lines (cached): axis-aligned lines across the N-D box [-R,R]^N
  buildWorldGridLines() {
    const R = this.gridRange;
    const s = this.gridSpacing;
    const steps = [];
    for (let v = -R; v <= R + 1e-9; v += s) steps.push(+v.toFixed(6));

    const lines = [];
    const n = this.dimensions;

    // For each axis k, other dims fixed to stepped values, axis varies -R..R
    for (let k = 0; k < n; k++) {
      const otherDims = [];
      for (let d = 0; d < n; d++) {
        if (d !== k) otherDims.push(d);
      }

      // Generate all combinations of step values for other dimensions
      const generateCombinations = (dims, index, current) => {
        if (index === dims.length) {
          const a = new Array(n).fill(0);
          const b = new Array(n).fill(0);
          a[k] = -R;
          b[k] = R;
          for (let i = 0; i < dims.length; i++) {
            a[dims[i]] = current[i];
            b[dims[i]] = current[i];
          }
          const isAxis = current.every(v => Math.abs(v) < 1e-9);
          lines.push({ a, b, isAxis });
          return;
        }
        for (const v of steps) {
          generateCombinations(dims, index + 1, [...current, v]);
        }
      };

      generateCombinations(otherDims, 0, []);
    }
    this._gridLinesWorld = lines;
  }

  // Project the fixed world grid (same set of lines) into cell (dimI, dimJ)
  drawWorldGrid(cellX, cellY, dimI, dimJ) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const viewRange = this.gridRange;

    // Clip to the inner plotting area
    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, startY, innerSize, innerSize);
    ctx.clip();

    const Rinv = this._orientationInverse;
    const P = this._playerWorld;

    if (!this._gridLinesWorld) this.buildWorldGridLines();

    // Map local coords to pixel
    const toPixel = (local) => {
      const px = startX + ((local[dimJ] / viewRange) + 1) * innerSize / 2;
      const py = startY + (1 - ((local[dimI] / viewRange) + 1) / 2) * innerSize;
      return [px, py];
    };

    // Draw every precomputed world line
    for (const line of this._gridLinesWorld) {
      const a = line.a, b = line.b;
      // Transform to oriented frame (Rinv * (world - P))
      const la = matVecMultN(Rinv, a.map((v, i) => v - P[i]));
      const lb = matVecMultN(Rinv, b.map((v, i) => v - P[i]));

      // Quick reject: both endpoints outside on same side in either dim
      const aI = la[dimI], bI = lb[dimI];
      const aJ = la[dimJ], bJ = lb[dimJ];
      const R = viewRange;
      if ((aI < -R && bI < -R) || (aI > R && bI > R) || (aJ < -R && bJ < -R) || (aJ > R && bJ > R)) {
        continue;
      }

      const px1 = startX + ((aJ / viewRange) + 1) * innerSize / 2;
      const py1 = startY + (1 - ((aI / viewRange) + 1) / 2) * innerSize;
      const px2 = startX + ((bJ / viewRange) + 1) * innerSize / 2;
      const py2 = startY + (1 - ((bI / viewRange) + 1) / 2) * innerSize;

      const isAxis = line.isAxis;
      ctx.strokeStyle = isAxis ? this.gridZeroColor : this.gridColor;
      ctx.lineWidth = isAxis ? this.gridLineWidth * 1.5 : this.gridLineWidth;
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }

    // Emphasize world boundary of the fixed box at +/- viewRange along both dims
    const drawBoundaryLine = (fixDim, fixVal, varyDim) => {
      const a = new Array(this.dimensions).fill(0);
      const b = new Array(this.dimensions).fill(0);
      a[fixDim] = fixVal;
      b[fixDim] = fixVal;
      a[varyDim] = -viewRange;
      b[varyDim] = +viewRange;
      const la = matVecMultN(Rinv, a.map((v, i) => v - P[i]));
      const lb = matVecMultN(Rinv, b.map((v, i) => v - P[i]));
      // Map using the cell axes: x uses dimJ, y uses dimI
      const x1 = startX + ((la[dimJ] / viewRange) + 1) * innerSize / 2;
      const y1 = startY + (1 - ((la[dimI] / viewRange) + 1) / 2) * innerSize;
      const x2 = startX + ((lb[dimJ] / viewRange) + 1) * innerSize / 2;
      const y2 = startY + (1 - ((lb[dimI] / viewRange) + 1) / 2) * innerSize;
      ctx.strokeStyle = this.gridBoundaryColor;
      ctx.lineWidth = this.gridBoundaryLineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    drawBoundaryLine(dimI, -viewRange, dimJ);
    drawBoundaryLine(dimI, +viewRange, dimJ);
    drawBoundaryLine(dimJ, -viewRange, dimI);
    drawBoundaryLine(dimJ, +viewRange, dimI);

    ctx.restore();
  }

  drawAxes(x, y) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = x + this.cellPadding;
    const startY = y + this.cellPadding;

    // Border rectangle only (no crosshair lines)
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, innerSize, innerSize);
  }

  /**
   * Draw player as a blue circle
   */
  drawPlayer(cellX, cellY, playerLocal, dimI, dimJ, ui) {
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;

    // Always draw at the center of the cell
    const px = startX + innerSize / 2;
    const py = startY + innerSize / 2;

    this.drawPlayerSprite(px, py, dimI, dimJ, ui);
  }

  drawPuffs(cellX, cellY, dimI, dimJ, ui) {
    if (!ui || !ui.puffs || ui.puffs.length === 0) return;
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const cx = startX + innerSize / 2;
    const cy = startY + innerSize / 2;
    const viewRange = this.scatterplot ? this.scatterplot.gridRange : 4.0;

    for (const p of ui.puffs) {
      let alpha = 0.9;
      if (p.life) alpha = Math.max(0, Math.min(1, p.ttl / p.life));
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.75 * alpha;
      ctx.fillStyle = '#9BE7FF';
      ctx.strokeStyle = '#66e6ff';
      ctx.lineWidth = 1.5;

      if (p.type === 'linear') {
        // Linear thrust puff: positioned behind ship along forward direction in local space
        const f = ui.forwardDir || [];
        const offset = -0.8; // units behind center in local space
        const puffPosLocal = f.map(v => v * offset);

        // Project into this 2D cell
        const px = cx + (puffPosLocal[dimJ] / viewRange) * innerSize / 2;
        const py = cy - (puffPosLocal[dimI] / viewRange) * innerSize / 2;

        // Check if within visible bounds
        const visible = Math.abs(puffPosLocal[dimI]) <= viewRange &&
                       Math.abs(puffPosLocal[dimJ]) <= viewRange;
        if (!visible) { ctx.restore(); continue; }

        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.type === 'angular') {
        // Angular puffs: positioned at diagonal corners in the rotation plane
        const plane = p.plane || [-1,-1];
        const a = plane[0], b = plane[1];
        const dir = -(p.dir || 1);

        // Create two puff positions in N-dimensional local space
        const offset = 0.5; // units from center
        const n = ui.forwardDir ? ui.forwardDir.length : 4;

        // Puff 1: +offset in dim a, +offset in dim b (or reversed for negative dir)
        const puff1Local = new Array(n).fill(0);
        const puff2Local = new Array(n).fill(0);

        if (dir > 0) {
          puff1Local[a] = offset;
          puff1Local[b] = offset;
          puff2Local[a] = -offset;
          puff2Local[b] = -offset;
        } else {
          puff1Local[a] = offset;
          puff1Local[b] = -offset;
          puff2Local[a] = -offset;
          puff2Local[b] = offset;
        }

        // Project both puffs into this 2D cell and draw them
        for (const puffLocal of [puff1Local, puff2Local]) {
          const px = cx + (puffLocal[dimJ] / viewRange) * innerSize / 2;
          const py = cy - (puffLocal[dimI] / viewRange) * innerSize / 2;

          // Check if within visible bounds
          const visible = Math.abs(puffLocal[dimI]) <= viewRange &&
                         Math.abs(puffLocal[dimJ]) <= viewRange;
          if (!visible) continue;

          // Size varies: larger in rotation plane, smaller in edge-on views
          const isRotationPlane = ((dimI === a && dimJ === b) || (dimI === b && dimJ === a));
          const radius = isRotationPlane ? 4.5 : 3.5;

          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  /**
   * Draw a smooth path as a connected curve
   */
  drawPath(cellX, cellY, pathData, dimI, dimJ) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const viewRange = this.gridRange;

    const { points, color, numbered, numDots = 6, squirrel, progress = 0, arcLengths } = pathData;

    // Helper to project point to screen coordinates
    const projectPoint = (point) => {
      const px = startX + (point[dimJ] / viewRange + 1) * innerSize / 2;
      const py = startY + (1 - (point[dimI] / viewRange + 1) / 2) * innerSize;
      return [px, py];
    };

    // Rainbow mode
    if (color === 'rainbow') {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw path segments with gradient colors
      for (let i = 0; i < points.length - 1; i++) {
        const t = i / (points.length - 1);
        const hue = t * 360;
        ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        
        const [px1, py1] = projectPoint(points[i]);
        const [px2, py2] = projectPoint(points[i + 1]);
        
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Numbered mode - show path with numbered dots
    if (numbered) {
      ctx.save();
      
      // Draw faint path line
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Draw numbered dots
      for (let n = 0; n < numDots; n++) {
        const idx = Math.floor(n * (points.length - 1) / (numDots - 1));
        const point = points[idx];
        const [px, py] = projectPoint(point);
        
        // Draw circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw number
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((n + 1).toString(), px, py);
      }
      
      ctx.restore();
      return;
    }

    // Squirrel mode - show animated marker
    if (squirrel) {
      ctx.save();
      
      // Draw faint path line
      ctx.strokeStyle = color.replace('0.8', '0.3');
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      let firstPoint = true;
      for (let i = 0; i < points.length; i++) {
        const [px, py] = projectPoint(points[i]);
        if (firstPoint) {
          ctx.moveTo(px, py);
          firstPoint = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Draw animated squirrel marker
      // Use arc length parameterization for constant speed
      let idx;
      if (arcLengths && arcLengths.length > 0) {
        // Find point index based on arc length progress
        const totalLength = arcLengths[arcLengths.length - 1];
        const targetLength = progress * totalLength;
        
        // Binary search for the right segment
        idx = 0;
        for (let i = 0; i < arcLengths.length - 1; i++) {
          if (arcLengths[i] <= targetLength && targetLength < arcLengths[i + 1]) {
            idx = i;
            break;
          }
        }
        // Handle edge case where we're at the very end
        if (targetLength >= totalLength - 0.001) {
          idx = points.length - 1;
        }
      } else {
        // Fallback to simple linear interpolation
        idx = Math.floor(progress * (points.length - 1));
      }
      
      const point = points[idx];
      const [px, py] = projectPoint(point);
      
      // Draw squirrel as a filled circle with ears
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw simple ears
      ctx.beginPath();
      ctx.arc(px - 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.arc(px + 3, py - 4, 2, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.restore();
      return;
    }

    // Vanilla mode - solid color path
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw path as connected line segments
    ctx.beginPath();
    let firstPoint = true;

    for (let i = 0; i < points.length; i++) {
      const [px, py] = projectPoint(points[i]);

      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw trail crumbs
   */
  drawTrail(cellX, cellY, trailLocal, dimI, dimJ) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const viewRange = this.gridRange;

    ctx.save();

    // Draw each crumb
    trailLocal.forEach((crumbPos, index) => {
      // Project to screen coordinates
      const px = startX + (crumbPos[dimJ] / viewRange + 1) * innerSize / 2;
      const py = startY + (1 - (crumbPos[dimI] / viewRange + 1) / 2) * innerSize;

      // Only draw if within visible range
      if (Math.abs(crumbPos[dimI]) > viewRange || Math.abs(crumbPos[dimJ]) > viewRange) {
        return;
      }

      // Fade older crumbs (oldest = start of array)
      const alpha = 0.3 + (index / trailLocal.length) * 0.5; // 0.3 to 0.8

      // Draw crumb as a small circle
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`; // Golden/yellow color
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Draw turkey (or medal if pardoned)
   */
  drawTurkey(cellX, cellY, turkey, dimI, dimJ) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const viewRange = this.gridRange;

    // Helper function to project a position to screen coordinates
    const projectToScreen = (pos) => {
      const px = startX + (pos[dimJ] / viewRange + 1) * innerSize / 2;
      const py = startY + (1 - (pos[dimI] / viewRange + 1) / 2) * innerSize;
      return { px, py };
    };

    // Get positions for each turkey part (already in local coordinates)
    const bodyPos = turkey.position;
    let headPos, nosePos;

    if (turkey.headPosLocal && turkey.nosePosLocal) {
      // Use pre-transformed positions
      headPos = turkey.headPosLocal;
      nosePos = turkey.nosePosLocal;
    } else {
      // Backwards compatibility: create random N-D direction based on rotation seed
      const rotation = turkey.rotation || 0;

      // Use rotation as seed for deterministic random direction
      const seededRandom = (seed, i) => {
        const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };

      const direction = bodyPos.map((_, i) => seededRandom(rotation, i) * 2 - 1);
      const len = Math.sqrt(direction.reduce((sum, x) => sum + x*x, 0));
      const unitDir = direction.map(x => x / len);

      headPos = bodyPos.map((v, i) => v + unitDir[i] * 0.30);
      nosePos = bodyPos.map((v, i) => v + unitDir[i] * 0.16);
    }

    // Project each part to screen coordinates
    const body = projectToScreen(bodyPos);
    const head = projectToScreen(headPos);
    const nose = projectToScreen(nosePos);

    // Only draw if body is within visible range (approximate visibility check)
    if (Math.abs(bodyPos[dimI]) > viewRange || Math.abs(bodyPos[dimJ]) > viewRange) {
      return;
    }

    if (turkey.pardoned) {
      // Draw gold medal at body position
      this.drawMedal(ctx, body.px, body.py, turkey.scale);
    } else {
      // Draw turkey with projected part positions
      this.drawTurkeySprite(ctx, body, head, nose, turkey.scale, turkey.hue);
    }
  }

  /**
   * Draw a simple turkey sprite with projected 3D coordinates
   * @param {Object} body - {px, py} screen coordinates for body
   * @param {Object} head - {px, py} screen coordinates for head
   * @param {Object} nose - {px, py} screen coordinates for nose/wattle
   */
  drawTurkeySprite(ctx, body, head, nose, scale, hue) {
    ctx.save();

    // Body (colored circle with outline) - use hue for color variation
    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.strokeStyle = `hsl(${hue}, 65%, 35%)`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(body.px, body.py, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head (small circle, lighter shade)
    ctx.fillStyle = `hsl(${hue}, 55%, 65%)`;
    ctx.strokeStyle = `hsl(${hue}, 65%, 35%)`;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(head.px, head.py, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wattle (red-orange accent)
    ctx.fillStyle = `hsl(${(hue + 180) % 360}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(nose.px, nose.py, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw a gold medal
   */
  drawMedal(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Gold circle
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner circle
    ctx.strokeStyle = '#B8860B';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Star in center
    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 0);

    ctx.restore();
  }

  /**
   * Draw grid lines between cells
   */
  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#646cff';
    ctx.lineWidth = 2;

    for (let i = 0; i <= this.dimensions; i++) {
      const pos = this.padding + i * this.cellSize;

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(this.padding, pos);
      ctx.lineTo(this.padding + this.dimensions * this.cellSize, pos);
      ctx.stroke();

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, this.padding);
      ctx.lineTo(pos, this.padding + this.dimensions * this.cellSize);
      ctx.stroke();
    }
  }

  /**
   * Draw dimension labels
   */
  drawLabels() {
    const ctx = this.ctx;
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.dimensions; i++) {
      const pos = this.padding + i * this.cellSize + this.cellSize / 2;

      // Top labels
      ctx.fillText(`Dim ${i + 1}`, pos, this.padding / 2);

      // Left labels
      ctx.save();
      ctx.translate(this.padding / 2, pos);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`Dim ${i + 1}`, 0, 0);
      ctx.restore();
    }
  }
}
