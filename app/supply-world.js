import * as THREE from 'three';

export function mountSupplyScene(host, onReady, onPlaying, motion) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#202822');
  scene.fog = new THREE.FogExp2('#313a31', 0.047);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 110);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);

  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
    return materials.get(color);
  }

  const cube = new THREE.BoxGeometry();
  function box(parent, width, height, depth, x, y, z, color) {
    const mesh = new THREE.Mesh(cube, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  scene.add(new THREE.HemisphereLight('#c4d6c0', '#343222', 2.15));
  const sun = new THREE.DirectionalLight('#ffcf86', 3.6);
  sun.position.set(8, 9, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 30 });
  scene.add(sun);

  const ground = box(scene, 115, 0.25, 115, 0, -0.125, 0, '#48463a');
  ground.castShadow = false;

  let seed = 719;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  const ridge = new THREE.ConeGeometry(1, 1, 5);
  for (let index = 0; index < 38; index++) {
    const hill = new THREE.Mesh(ridge, material(index % 2 ? '#454e42' : '#363d35'));
    hill.position.set((random() - 0.5) * 95, 0, -10 - random() * 55);
    hill.scale.set(3 + random() * 13, 2 + random() * 12, 4 + random() * 10);
    hill.rotation.y = random() * Math.PI;
    scene.add(hill);
  }

  const stone = new THREE.DodecahedronGeometry(1, 0);
  for (let index = 0; index < 95; index++) {
    const rock = new THREE.Mesh(stone, material(index % 2 ? '#625b46' : '#55564a'));
    const size = 0.04 + random() * 0.2;
    rock.position.set((random() - 0.5) * 27, size * 0.12, (random() - 0.65) * 23);
    rock.scale.set(size * 1.8, size * 0.48, size);
    rock.rotation.y = random() * Math.PI;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 128;
  const ink = label.getContext('2d');
  ink.fillStyle = '#dfcc9d';
  ink.font = 'bold 55px monospace';
  ink.fillText('FIELD SUPPLY', 18, 66);
  ink.font = '26px monospace';
  ink.fillText('LOGISTICS / 07', 20, 105);
  const stencil = new THREE.CanvasTexture(label);
  stencil.colorSpace = THREE.SRGBColorSpace;
  const decalMaterial = new THREE.MeshStandardMaterial({ map: stencil, transparent: true, alphaTest: 0.2 });
  const decalGeometry = new THREE.PlaneGeometry(1.18, 0.295);

  function crate(x, y, z, scale, angle, color) {
    const unit = new THREE.Group();
    unit.position.set(x, y, z);
    unit.rotation.y = angle;
    unit.scale.setScalar(scale);
    scene.add(unit);
    box(unit, 2.1, 0.9, 1.22, 0, 0.49, 0, color);
    box(unit, 2.18, 0.09, 1.29, 0, 0.96, 0, '#72745b');
    for (const side of [-1, 1]) {
      box(unit, 0.15, 0.94, 1.29, side * 0.80, 0.51, 0, '#292e26');
      box(unit, 0.12, 0.19, 0.04, side * 0.64, 0.79, 0.64, '#b09f71');
      box(unit, 1.95, 0.05, 0.04, 0, 0.51 + side * 0.26, 0.615, '#515543');
    }
    const decal = new THREE.Mesh(decalGeometry, decalMaterial);
    decal.position.set(0.035, 0.46, 0.639);
    unit.add(decal);
  }

  for (const x of [-0.91, 0, 0.91]) {
    box(scene, 0.21, 0.18, 1.77, 1.85 + x, 0.09, 0.12, '#4a3828');
  }
  for (const z of [-0.67, -0.28, 0.12, 0.52, 0.85]) {
    box(scene, 2.18, 0.10, 0.23, 1.85, 0.22, z, '#746049');
  }
  crate(1.85, 0.25, 0.12, 1.05, 0.03, '#555c43');
  crate(1.88, 1.29, 0.07, 0.82, -0.12, '#685c3f');
  crate(3.55, 0, 1.10, 0.65, -0.35, '#61664d');
  crate(4.4, 0, -2, 0.94, 0.25, '#4c5948');

  let frame;
  let startedAt;
  let playing = false;
  const duration = 7800;

  function draw(progress) {
    const mobile = host.clientWidth < 680;
    camera.position.set(4.9 - progress * 2.2, mobile ? 2.9 : 3.3, 7.1 + progress * 0.6);
    camera.lookAt(mobile ? 2.05 : -0.2, mobile ? 0.65 : 0.95, -0.45);
    renderer.render(scene, camera);
  }

  let progress = 0;
  function stop() {
    cancelAnimationFrame(frame);
    playing = false;
    onPlaying(false);
  }

  function tick(now) {
    startedAt ??= now - progress * duration;
    progress = Math.min((now - startedAt) / duration, 1);
    draw(progress * progress * (3 - 2 * progress));
    if (progress < 1) frame = requestAnimationFrame(tick);
    else stop();
  }

  function play() {
    startedAt = undefined;
    if (progress === 1) progress = 0;
    playing = true;
    onPlaying(true);
    frame = requestAnimationFrame(tick);
  }

  const resizer = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, host.clientWidth < 680 ? 1 : 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    draw(progress * progress * (3 - 2 * progress));
  });
  resizer.observe(host);
  onReady(() => playing ? stop() : play());
  if (!motion.matches && host.clientWidth >= 680) play();

  const onMotionChange = () => { if (motion.matches) stop(); };
  motion.addEventListener('change', onMotionChange);

  return () => {
    cancelAnimationFrame(frame);
    motion.removeEventListener('change', onMotionChange);
    resizer.disconnect();
    for (const item of [cube, ridge, stone, decalGeometry, decalMaterial, stencil, ...materials.values()]) item.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
