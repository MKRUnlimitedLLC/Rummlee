import * as THREE from "three";
import { dogMask, simplifyLoop, traceDog } from "@/lib/rummlee/bandit-shape";

type Phase = "wait" | "listening" | "speaking";

export function mountBanditDog(
  host: HTMLElement,
  getPhase: () => string,
  onDrag: () => void,
  onFail: () => void,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  camera.position.set(0, 0, 520);
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.15);
  key.position.set(80, 160, 240);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd9cfc4, 0.35);
  fill.position.set(-120, -40, 80);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);
  let mesh: THREE.Mesh | null = null;
  let alive = true;
  let frame = 0;
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0.35;
  let pitch = 0;

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.01;
    pitch = Math.max(-0.6, Math.min(0.6, pitch + dy * 0.006));
    if (moved > 12) onDrag();
  }
  function onPointerUp() {
    dragging = false;
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  void build().catch(() => onFail());

  function tick(now: number) {
    if (!alive) return;
    frame = requestAnimationFrame(tick);
    const phase = getPhase() as Phase;
    const t = now / 1000;
    if (mesh) {
      const lean = phase === "listening" ? 0.28 : phase === "speaking" ? Math.sin(t * 7) * 0.12 : Math.sin(t * 1.3) * 0.04;
      const spin = dragging ? 0 : phase === "speaking" ? Math.sin(t * 2.2) * 0.08 : Math.sin(t * 0.45) * 0.22;
      mesh.rotation.y = yaw + spin;
      mesh.rotation.x = pitch + lean;
      mesh.position.y = Math.sin(t * (phase === "speaking" ? 3.2 : 1.4)) * (phase === "speaking" ? 6 : 4);
    }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);

  async function build() {
    const image = await loadMark();
    if (!alive) return;
    const source = document.createElement("canvas");
    source.width = image.width;
    source.height = image.height;
    const ctx = source.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      onFail();
      return;
    }
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    const mask = dogMask(source.width, source.height, pixels.data);
    const loop = simplifyLoop(traceDog(mask, source.width, source.height), 1.6);
    if (loop.length < 8) {
      onFail();
      return;
    }
    for (let i = 0; i < mask.length; i += 1) {
      if (!mask[i]) pixels.data[i * 4 + 3] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
    const cx = source.width / 2;
    const cy = source.height / 2;
    const shape = new THREE.Shape();
    loop.forEach(([x, y], index) => {
      const px = x - cx;
      const py = cy - y;
      if (index === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    });
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 16,
      bevelEnabled: true,
      bevelThickness: 1.4,
      bevelSize: 1.1,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -8);
    const uv = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      uv.setXY(i, (position.getX(i) + cx) / source.width, (position.getY(i) + cy) / source.height);
    }
    uv.needsUpdate = true;
    geometry.computeVertexNormals();
    const texture = new THREE.CanvasTexture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const cap = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.FrontSide });
    const edge = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.72, metalness: 0.04 });
    const built = new THREE.Mesh(geometry, [cap, edge]);
    built.position.y = -6;
    mesh = built;
    root.add(built);
  }

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    renderer.dispose();
    canvas.remove();
    root.traverse((obj) => {
      const cast = obj as THREE.Mesh;
      if (!cast.geometry) return;
      cast.geometry.dispose();
      const materials = Array.isArray(cast.material) ? cast.material : [cast.material];
      materials.forEach((material) => {
        const mapped = material as THREE.MeshBasicMaterial;
        mapped.map?.dispose();
        material.dispose();
      });
    });
  };
}

function loadMark() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("mark"));
    image.src = "/brand/mark.png";
  });
}
