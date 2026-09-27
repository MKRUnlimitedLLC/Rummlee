/** Opaque dog vs the white page behind the logo. The ink is thickened so the flood cannot leak through the outline into the chest. */

export function dogMask(width: number, height: number, rgba: Uint8ClampedArray) {
  const n = width * height;
  const pale = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    if (rgba[o] > 246 && rgba[o + 1] > 246 && rgba[o + 2] > 246) pale[i] = 1;
  }
  const barrier = new Uint8Array(n);
  const rad = 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pale[y * width + x]) continue;
      for (let dy = -rad; dy <= rad; dy += 1) {
        for (let dx = -rad; dx <= rad; dx += 1) {
          if (dx * dx + dy * dy > rad * rad) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          barrier[yy * width + xx] = 1;
        }
      }
    }
  }
  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (barrier[i] || bg[i] || !pale[i]) return;
    bg[i] = 1;
    queue[tail] = i;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (head < tail) {
    const i = queue[head];
    head += 1;
    const x = i % width;
    const y = (i - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  const dog = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) dog[i] = bg[i] ? 0 : 1;
  return dog;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export function traceDog(mask: Uint8Array, width: number, height) {
  let sx = -1;
  let sy = 0;
  for (let y = 0; y < height && sx < 0; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        sx = x;
        sy = y;
        break;
      }
    }
  }
  if (sx < 0) return [] as Array<[number, number]>;
  const points: Array<[number, number]> = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  const limit = width * height;
  do {
    points.push([x, y]);
    const start = (dir + 6) & 7;
    let found = false;
    for (let k = 0; k < 8; k += 1) {
      const nd = (start + k) & 7;
      const nx = x + DIRS[nd][0];
      const ny = y + DIRS[nd][1];
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) {
        x = nx;
        y = ny;
        dir = nd;
        found = true;
        break;
      }
    }
    if (!found) break;
  } while (!(x === sx && y === sy) && points.length < limit);
  return points;
}

function perp(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
}

export function simplifyLoop(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 8) return points;
  const keep = rdp(points, epsilon);
  if (keep.length > 2 && keep[0][0] === keep[keep.length - 1][0] && keep[0][1] === keep[keep.length - 1][1]) {
    keep.pop();
  }
  return keep;
}

function rdp(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 3) return points.slice();
  let max = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perp(first[0], first[1], last[0], last[1], points[i][0], points[i][1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}
