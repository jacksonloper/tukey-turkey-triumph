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

  resize() {
    // Calculate available width dynamically based on viewport
    // Mobile (< 600px): app padding 0.5rem, play-area padding 8px, border 2px
    // Desktop: app padding 1rem, play-area padding 12px, border 2px
    const isMobile = window.innerWidth < 600;
    const appPadding = isMobile ? 16 : 32; // 0.5rem or 1rem * 2 sides
    const playAreaPadding = isMobile ? 16 : 24; // 8px or 12px * 2 sides
    const playAreaBorder = 4; // 2px * 2 sides
    const totalPadding = appPadding + playAreaPadding + playAreaBorder;

    const size = Math.min(800, window.innerWidth - totalPadding);

    // Account for device pixel ratio for high-DPI displays
    const dpr = window.devicePixelRatio || 1;

    // Set canvas internal resolution (scaled by DPR)
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;

    // Set canvas CSS size (display size)
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';

    // IMPORTANT: Reset transform before scaling to avoid compounding
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Scale context to match DPR
    this.ctx.scale(dpr, dpr);

    // Store the display size for calculations
    this.displaySize = size;
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
    const rect = this.canvas.getBoundingClientRect();
    // Convert from screen coordinates to canvas display coordinates
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
      return {
        position: localPos,
        pardoned: turkey.pardoned,
        scale: turkey.scale,
        rotation: turkey.rotation,
        hue: turkey.hue
      };
    });

    // Draw each cell in the matrix
    for (let row = 0; row < this.dimensions; row++) {
      for (let col = 0; col < this.dimensions; col++) {
        this.renderCell(row, col, playerLocal, turkeysLocal, ui);
      }
    }

    // Draw grid and labels
    this.drawGrid();
    this.drawLabels();
  }

  /**
   * Render a single scatterplot cell
   */
  renderCell(row, col, playerLocal, turkeysLocal, ui) {
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

    // Draw world-aligned fixed grid projected into this view (same for every cell)
    this.drawWorldGrid(x, y, row, col);

    // Draw axes
    this.drawAxes(x, y);

    // Draw turkeys
    turkeysLocal.forEach(turkey => {
      this.drawTurkey(x, y, turkey, row, col);
    });

    // Draw player
    this.drawPlayer(x, y, playerLocal, row, col, ui);

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
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;

    // Always draw at the center of the cell
    const px = startX + innerSize / 2;
    const py = startY + innerSize / 2;

    if (ui.shipType === 'druuge') {
      // Draw a small rectangle oriented by forward vector projection in this plane
      const f = ui.forwardDir || [1,0,0,0];
      const vx = f[dimJ] || 0;
      const vy = f[dimI] || 0;
      let ang = 0;
      if (Math.abs(vx) + Math.abs(vy) > 1e-6) {
        ang = Math.atan2(-vy, vx);
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 2;
      // width x height (length along x)
      const w = 18, h = 8;
      ctx.beginPath();
      ctx.rect(-w/2, -h/2, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // Aerilou: blue dot
      ctx.fillStyle = '#00d4ff';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawPuffs(cellX, cellY, dimI, dimJ, ui) {
    if (!ui || !ui.puffs || ui.puffs.length === 0) return;
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;
    const cx = startX + innerSize / 2;
    const cy = startY + innerSize / 2;

    const f = ui.forwardDir || [1,0,0,0];
    const vx = f[dimJ] || 0;
    const vy = f[dimI] || 0;
    // Unit vector for forward projection in this plane (pixels)
    let fx = 0, fy = 0;
    if (Math.abs(vx) + Math.abs(vy) > 1e-6) {
      const len = Math.hypot(vx, vy);
      fx = vx / len;
      fy = -vy / len; // invert y for canvas
    }

    for (const p of ui.puffs) {
      let alpha = 0.9;
      if (p.life) alpha = Math.max(0, Math.min(1, p.ttl / p.life));
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.75 * alpha;
      ctx.fillStyle = '#9BE7FF';
      ctx.strokeStyle = '#66e6ff';
      ctx.lineWidth = 1.5;

      if (p.type === 'linear') {
        if (fx === 0 && fy === 0) { ctx.restore(); continue; }
        const back = -14; // pixels behind center
        const px = cx + fx * back;
        const py = cy + fy * back;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.type === 'angular') {
        const plane = p.plane || [-1,-1];
        const a = plane[0], b = plane[1];
        // Draw only on the appropriate frame(s)
        if (!((dimI === a && dimJ === b) || (dimI === b && dimJ === a))) { ctx.restore(); continue; }

        // Derive forward and left vectors in this cell
        let tfx = fx, tfy = fy;
        if (tfx === 0 && tfy === 0) { tfx = 1; tfy = 0; }
        const lx = -tfy; // left vector (perpendicular)
        const ly = tfx;

        const front = 12; // px along forward
        const side = 10;  // px along left/right
        const dir = -(p.dir || 1); // flipped to match physical torque direction

        // For positive dir: left puff forward-left, right puff back-right
        // For negative dir: left puff back-left, right puff forward-right
        const leftX  = cx + (dir > 0 ? (tfx*front + lx*side) : (tfx*(-front) + lx*side));
        const leftY  = cy + (dir > 0 ? (tfy*front + ly*side) : (tfy*(-front) + ly*side));
        const rightX = cx + (dir > 0 ? (tfx*(-front) - lx*side) : (tfx*front - lx*side));
        const rightY = cy + (dir > 0 ? (tfy*(-front) - ly*side) : (tfy*front - ly*side));

        ctx.beginPath();
        ctx.arc(leftX, leftY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rightX, rightY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Draw turkey (or medal if pardoned)
   */
  drawTurkey(cellX, cellY, turkey, dimI, dimJ) {
    const ctx = this.ctx;
    const innerSize = this.cellSize - this.cellPadding * 2;
    const startX = cellX + this.cellPadding;
    const startY = cellY + this.cellPadding;

    // Map from [-R, R] local coords to [0, innerSize] pixels
    const viewRange = this.gridRange;
    const px = startX + (turkey.position[dimJ] / viewRange + 1) * innerSize / 2;
    const py = startY + (1 - (turkey.position[dimI] / viewRange + 1) / 2) * innerSize;

    // Only draw if within visible range
    if (Math.abs(turkey.position[dimI]) > viewRange || Math.abs(turkey.position[dimJ]) > viewRange) {
      return;
    }

    if (turkey.pardoned) {
      // Draw gold medal
      this.drawMedal(ctx, px, py, turkey.scale);
    } else {
      // Draw turkey
      this.drawTurkeySprite(ctx, px, py, turkey.rotation, turkey.scale, turkey.hue);
    }
  }

  /**
   * Draw a simple turkey sprite
   */
  drawTurkeySprite(ctx, x, y, rotation, scale, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Body (colored circle with outline) - use hue for color variation
    ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
    ctx.strokeStyle = `hsl(${hue}, 65%, 35%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head (small circle, lighter shade)
    ctx.fillStyle = `hsl(${hue}, 55%, 65%)`;
    ctx.strokeStyle = `hsl(${hue}, 65%, 35%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wattle (red-orange accent)
    ctx.fillStyle = `hsl(${(hue + 180) % 360}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(0, -4, 1.5, 0, Math.PI * 2);
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
