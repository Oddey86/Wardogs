import * as THREE from 'three';

// "Anatomy of a shot": a stylised rifle built from primitives. Everything is a pure
// function of scroll progress p (0..1), so the sequence can be scrubbed both ways.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => t * t * (3 - 2 * t);
const easeIn = t => t * t;
const lerp = (a, b, t) => a + (b - a) * t;
const bump = (p, a, b) => Math.sin(Math.PI * seg(p, a, b));

// Layout (1 unit ≈ 10 cm). Bore axis at y = 0.25, muzzle at +x.
const BORE_Y = 0.25;
const CHAMBER_X = 0.62;          // case rear when chambered
const CARRIER_FRONT = 0.6;       // bolt face at rest
const CARRIER_TRAVEL = 1.3;
const MUZZLE_X = 5.75;
const TARGET_X = 46;
const MAG_IN_Y = 0.05;
const MAG_OUT_Y = -3.4;
const ROUNDS = 5;

export function mountAnatomyScene(host, { mobile } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f120e');
  scene.fog = new THREE.Fog('#0f120e', 14, 70);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 160);
  const disposables = [];
  const keep = item => (disposables.push(item), item);

  // Studio-style reflections so metal reads as metal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envBox = keep(new THREE.BoxGeometry(1, 1, 1));
  const envRoom = new THREE.Mesh(envBox, keep(new THREE.MeshBasicMaterial({ color: '#2a2d26', side: THREE.BackSide })));
  envRoom.scale.set(20, 12, 20);
  envScene.add(envRoom);
  for (const [x, y, z, sx, sy, sz, k, tint] of [
    [0, 5.9, 0, 8, 0.1, 4, 6, '#fff4e0'],
    [-9.9, 2, 0, 0.1, 4, 10, 2.2, '#cfd8ff'],
    [9.9, 3, -3, 0.1, 3, 5, 3.5, '#ffd9a0'],
    [0, 1, 9.9, 12, 2, 0.1, 1.2, '#ffffff'],
  ]) {
    const material = keep(new THREE.MeshBasicMaterial({ color: tint }));
    material.color.multiplyScalar(k);
    const panel = new THREE.Mesh(envBox, material);
    panel.position.set(x, y, z);
    panel.scale.set(sx, sy, sz);
    envScene.add(panel);
  }
  const envMap = keep(pmrem.fromScene(envScene, 0.035).texture);
  pmrem.dispose();
  scene.environment = envMap;

  scene.add(new THREE.HemisphereLight('#b9c7b4', '#1b1d16', 0.55));
  const key = new THREE.DirectionalLight('#ffe2b0', 2.4);
  key.position.set(4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 25 });
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#9fb7ff', 1.3);
  rim.position.set(-6, 3, -5);
  scene.add(rim);

  // Materials
  const mat = {
    gunmetal: new THREE.MeshStandardMaterial({ color: '#2b2e2b', metalness: 0.85, roughness: 0.42 }),
    polymer: new THREE.MeshStandardMaterial({ color: '#3d4134', metalness: 0.05, roughness: 0.78 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9aa09c', metalness: 1, roughness: 0.28 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#4a4e4b', metalness: 0.95, roughness: 0.35 }),
    brass: new THREE.MeshStandardMaterial({ color: '#d0a54c', metalness: 1, roughness: 0.24 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b86b3e', metalness: 1, roughness: 0.27 }),
    spring: new THREE.MeshStandardMaterial({ color: '#c7c9c2', metalness: 1, roughness: 0.32 }),
    accent: new THREE.MeshStandardMaterial({ color: '#eac46a', metalness: 0.6, roughness: 0.4 }),
    ground: new THREE.MeshStandardMaterial({ color: '#171a14', metalness: 0, roughness: 0.95 }),
    target: new THREE.MeshStandardMaterial({ color: '#c9c3ad', metalness: 0.4, roughness: 0.55 }),
  };
  Object.values(mat).forEach(keep);

  // Outer shell materials fade out for the x-ray view.
  const shellMats = ['gunmetal', 'polymer'].map(name => {
    const m = keep(mat[name].clone());
    m.transparent = true;
    return m;
  });
  const [shellMetal, shellPolymer] = shellMats;

  function mesh(geometry, material, parent = rifle, shadow = true) {
    keep(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }
  function extrude(points, depth, material, { bevel = 0.02, parent } = {}) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    geometry.translate(0, 0, -depth / 2);
    return mesh(geometry, material, parent);
  }
  function boxAt(x0, x1, y0, y1, depth, material, parent) {
    const m = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, depth), material, parent);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return m;
  }
  function rodX(x0, x1, radius, y, material, parent, segments = 28) {
    const geometry = new THREE.CylinderGeometry(radius, radius, x1 - x0, segments);
    geometry.rotateZ(-Math.PI / 2);
    const m = mesh(geometry, material, parent);
    m.position.set((x0 + x1) / 2, y, 0);
    return m;
  }
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }

  const rifle = new THREE.Group();
  scene.add(rifle);

  // ---- Outer shell ---------------------------------------------------------
  const shell = [];
  const addShell = m => (shell.push(m), m.renderOrder = 2, m);
  addShell(extrude([[-2.6, 0], [0.9, 0], [0.9, 0.5], [0.82, 0.56], [-2.5, 0.56], [-2.6, 0.48]], 0.5, shellMetal));
  addShell(extrude([[-2.6, 0.02], [0.75, 0.02], [0.75, -0.78], [0.62, -0.86], [-0.26, -0.86], [-0.3, -0.4], [-1.05, -0.4],
    [-1.32, -1.55], [-1.78, -1.58], [-1.62, -0.44], [-2.6, -0.3]], 0.46, shellMetal));
  // Handguard with vents
  {
    const geometry = new THREE.ExtrudeGeometry(roundedRect(0.68, 0.72, 0.16), { depth: 3, bevelEnabled: false, curveSegments: 10 });
    geometry.rotateY(-Math.PI / 2);
    const hg = addShell(mesh(geometry, shellPolymer));
    hg.position.set(3.9, BORE_Y, 0);
    const ventGeo = keep(new THREE.BoxGeometry(0.32, 0.07, 0.02));
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
      const v = addShell(mesh(ventGeo, shellMetal, rifle, false));
      v.position.set(1.25 + i * 0.38, BORE_Y + 0.08, side * 0.345);
    }
  }
  // Stock and buffer tube
  addShell(extrude([[-3.3, 0.44], [-5.2, 0.44], [-5.26, -0.78], [-4.92, -0.8], [-3.45, -0.06], [-3.3, 0.06]], 0.42, shellPolymer));
  addShell(rodX(-3.45, -2.6, 0.17, 0.22, shellMetal));
  boxAt(-5.3, -5.18, -0.8, 0.46, 0.44, mat.darkSteel); // butt pad
  // Barrel and muzzle device
  addShell(rodX(0.9, 5.2, 0.085, BORE_Y, shellMetal));
  addShell(rodX(5.2, MUZZLE_X, 0.13, BORE_Y, shellMetal));
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    const slot = mesh(keep(new THREE.BoxGeometry(0.07, 0.05, 0.03)), mat.darkSteel, rifle, false);
    slot.position.set(5.32 + i * 0.13, BORE_Y + 0.05, side * 0.125);
  }
  // Rail, sights, trigger guard (always solid; they sit outside the action)
  boxAt(-2.45, 3.85, 0.56, 0.64, 0.34, mat.darkSteel);
  {
    const tooth = keep(new THREE.BoxGeometry(0.09, 0.05, 0.36));
    const teeth = new THREE.InstancedMesh(tooth, mat.darkSteel, 34);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 34; i++) teeth.setMatrixAt(i, m4.makeTranslation(-2.35 + i * 0.185, 0.665, 0));
    teeth.castShadow = true;
    rifle.add(teeth);
  }
  extrude([[-2.3, 0.69], [-1.9, 0.69], [-1.95, 0.95], [-2.25, 0.95]], 0.24, mat.gunmetal);
  extrude([[3.45, 0.69], [3.75, 0.69], [3.7, 1.0], [3.58, 1.0]], 0.2, mat.gunmetal);
  extrude([[-1.12, -0.66], [-0.28, -0.66], [-0.28, -0.6], [-1.12, -0.6]], 0.16, mat.gunmetal, { bevel: 0.015 });

  // ---- Internals -------------------------------------------------------------
  const carrier = new THREE.Group();
  rifle.add(carrier);
  boxAt(CARRIER_FRONT - 1.3, CARRIER_FRONT - 0.12, BORE_Y - 0.13, BORE_Y + 0.13, 0.26, mat.steel, carrier);
  rodX(CARRIER_FRONT - 0.14, CARRIER_FRONT, 0.1, BORE_Y, mat.darkSteel, carrier);       // bolt head
  boxAt(CARRIER_FRONT - 0.95, CARRIER_FRONT - 0.65, BORE_Y + 0.13, BORE_Y + 0.22, 0.14, mat.darkSteel, carrier); // gas key
  const pin = new THREE.Group();
  carrier.add(pin);
  rodX(CARRIER_FRONT - 0.95, CARRIER_FRONT - 0.02, 0.022, BORE_Y, mat.accent, pin, 12);

  const handle = new THREE.Group();
  rifle.add(handle);
  boxAt(-2.55, -1.6, 0.5, 0.58, 0.12, mat.darkSteel, handle);
  boxAt(-2.62, -2.48, 0.46, 0.6, 0.62, mat.gunmetal, handle);

  // Hammer and trigger pivot in the lower receiver
  const hammer = new THREE.Group();
  hammer.position.set(-0.75, -0.22, 0);
  rifle.add(hammer);
  extrude([[-0.06, -0.06], [0.06, -0.06], [0.08, 0.4], [0.18, 0.46], [0.16, 0.52], [-0.04, 0.48]], 0.1, mat.steel, { bevel: 0.01, parent: hammer });
  const trigger = new THREE.Group();
  trigger.position.set(-0.95, -0.3, 0);
  rifle.add(trigger);
  extrude([[-0.04, 0.05], [0.05, 0.05], [0.04, -0.12], [0.1, -0.3], [0.02, -0.34], [-0.03, -0.16]], 0.08, mat.steel, { bevel: 0.01, parent: trigger });
  rodX(-1.0, -0.5, 0.02, -0.18, mat.darkSteel); // hammer spring hint

  // Magazine (own group; rounds are positioned in rifle space)
  const magazine = new THREE.Group();
  rifle.add(magazine);
  const magBody = extrude([[-0.3, 0], [0.72, 0], [0.98, -2.0], [1.02, -2.0], [1.02, -2.13], [-0.1, -2.13], [-0.06, -2.0]], 0.36, shellMetal, { parent: magazine });
  addShell(magBody);
  const follower = boxAt(-0.2, 0.6, -0.05, 0, 0.26, mat.polymer, magazine);
  const springGeo = new THREE.TubeGeometry(new (class extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * Math.PI * 2 * 9;
      return target.set(0.24 + Math.cos(a) * 0.3 + t * 0.12, -t, Math.sin(a) * 0.1);
    }
  })(), 260, 0.012, 6, false);
  const spring = mesh(springGeo, mat.spring, magazine);

  // Cartridges: case + bullet as separate meshes so they can part ways.
  const caseGeo = keep(new THREE.LatheGeometry([[0, 0], [0.048, 0], [0.048, 0.03], [0.041, 0.036], [0.041, 0.052], [0.05, 0.062],
    [0.05, 0.44], [0.032, 0.49], [0.032, 0.57], [0.028, 0.57]].map(([r, y]) => new THREE.Vector2(r, y)), 32));
  caseGeo.rotateZ(-Math.PI / 2);
  const bulletGeo = keep(new THREE.LatheGeometry([[0, 0.5], [0.031, 0.5], [0.031, 0.62], [0.024, 0.7], [0.012, 0.77], [0, 0.81]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 32));
  bulletGeo.rotateZ(-Math.PI / 2);
  const rounds = [];
  for (let i = 0; i < ROUNDS; i++) {
    const c = new THREE.Mesh(caseGeo, mat.brass);
    const b = new THREE.Mesh(bulletGeo, mat.copper);
    c.castShadow = b.castShadow = true;
    rifle.add(c, b);
    rounds.push({ c, b });
  }

  // Effects
  const glowTex = keep(radialTexture(['rgba(255,240,200,1)', 'rgba(255,170,60,.65)', 'rgba(255,90,20,0)']));
  const smokeTex = keep(radialTexture(['rgba(190,190,180,.55)', 'rgba(150,150,140,.22)', 'rgba(120,120,110,0)']));
  const flashMat = keep(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const flash = new THREE.Sprite(flashMat);
  flash.position.set(MUZZLE_X + 0.35, BORE_Y, 0);
  rifle.add(flash);
  const flashCones = [];
  for (let i = 0; i < 4; i++) {
    const g = keep(new THREE.ConeGeometry(0.11, 0.9, 12, 1, true));
    g.rotateZ(-Math.PI / 2);
    g.translate(0.45, 0, 0);
    const m = keep(new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const cone = new THREE.Mesh(g, m);
    cone.position.set(MUZZLE_X, BORE_Y, 0);
    cone.rotation.set(i * Math.PI / 2, i === 0 ? 0 : (i % 2 ? 0.55 : -0.55), i === 0 ? 0 : (i < 3 ? 0.5 : -0.5));
    rifle.add(cone);
    flashCones.push(cone);
  }
  const flashLight = new THREE.PointLight('#ffb35c', 0, 9, 1.6);
  flashLight.position.set(MUZZLE_X + 0.6, BORE_Y, 0.2);
  rifle.add(flashLight);
  const chamberLight = new THREE.PointLight('#ff8a3c', 0, 2.5, 2);
  chamberLight.position.set(0.9, BORE_Y, 0.2);
  rifle.add(chamberLight);
  const smoke = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false })));
    rifle.add(s);
    smoke.push({ s, dx: 0.25 + i * 0.22, dy: Math.sin(i * 2.1) * 0.12, dz: Math.cos(i * 1.7) * 0.15, size: 0.5 + (i % 3) * 0.25 });
  }
  const trailMat = keep(new THREE.MeshBasicMaterial({ color: '#ffe3a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const trailGeo = keep(new THREE.CylinderGeometry(0.004, 0.026, 1, 10, 1, true));
  trailGeo.rotateZ(Math.PI / 2);
  const trail = new THREE.Mesh(trailGeo, trailMat);
  scene.add(trail);
  const spark = new THREE.Sprite(flashMat.clone());
  keep(spark.material);
  scene.add(spark);

  // Range: ground, distance markers, steel target
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(220, 60)), mat.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -2.35, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  const postGeo = keep(new THREE.BoxGeometry(0.08, 1.2, 0.08));
  const capGeo = keep(new THREE.BoxGeometry(0.14, 0.1, 0.14));
  for (let x = 10; x < TARGET_X; x += 6) for (const z of [-1.6, 1.6]) {
    const post = new THREE.Mesh(postGeo, mat.darkSteel);
    post.position.set(x, -1.75, z);
    const cap = new THREE.Mesh(capGeo, mat.accent);
    cap.position.set(x, -1.12, z);
    scene.add(post, cap);
  }
  const targetGroup = new THREE.Group();
  targetGroup.position.set(TARGET_X, 1.1, 0);
  scene.add(targetGroup);
  const plateGeo = keep(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 48));
  plateGeo.rotateZ(Math.PI / 2);
  plateGeo.translate(0, -0.85, 0);
  const plate = new THREE.Mesh(plateGeo, mat.target);
  plate.castShadow = true;
  targetGroup.add(plate);
  const ringGeo = keep(new THREE.RingGeometry(0.2, 0.28, 40));
  ringGeo.rotateY(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mat.accent);
  ring.position.set(-0.035, -0.85, 0);
  plate.add(ring);
  const legGeo = keep(new THREE.BoxGeometry(0.1, 3.55, 0.1));
  for (const z of [-0.95, 0.95]) {
    const leg = new THREE.Mesh(legGeo, mat.darkSteel);
    leg.position.set(TARGET_X, -0.6, z);
    leg.castShadow = true;
    scene.add(leg);
  }
  const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 0.1, 2)), mat.darkSteel);
  bar.position.set(TARGET_X, 1.15, 0);
  scene.add(bar);

  // ---- Timeline --------------------------------------------------------------
  const magSlot = (k, magY) => ({ x: -0.2 + k * 0.012, y: magY - 0.17 - k * 0.105, z: k % 2 ? 0.045 : -0.045 });

  function place(round, x, y, z, tilt = 0, spin = 0) {
    for (const m of [round.c, round.b]) {
      m.position.set(x, y, z);
      m.rotation.set(spin, 0, tilt);
    }
  }
  function feedPath(slot, front) {
    const t = clamp((front - slot.x) / (CHAMBER_X - slot.x));
    return { x: lerp(slot.x, CHAMBER_X, t), y: lerp(slot.y, BORE_Y, ease(clamp(t / 0.75))), z: lerp(slot.z, 0, t), tilt: Math.sin(Math.PI * t) * 0.22, t };
  }
  const carrierOffset = p => -CARRIER_TRAVEL * (ease(seg(p, 0.30, 0.36)) - ease(seg(p, 0.37, 0.44)) + ease(seg(p, 0.535, 0.575)) - ease(seg(p, 0.58, 0.62)));

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const keyframes = [
    [0.0, [1.2, 1.1, 4.6], [0.35, -0.45, 0]],
    [0.11, [0.9, 0.2, 5.0], [0.3, -0.65, 0]],
    [0.24, [-0.1, 0.5, 6.2], [0.0, -0.3, 0]],
    [0.31, [-0.7, 1.0, 5.6], [-0.45, 0.05, 0]],
    [0.44, [-0.4, 0.55, 4.8], [-0.35, 0.0, 0]],
    [0.5, [0.5, 0.8, 6.2], [0.55, 0.15, 0]],
    [0.57, [1.6, 1.6, 10.5], [1.4, 0.0, 0]],
    [0.63, [5.4, 0.8, 3.6], [7.6, 0.25, 0]],
  ];
  const v3 = new THREE.Vector3();
  function keyCam(p, pos, tgt) {
    let i = 0;
    while (i < keyframes.length - 2 && p > keyframes[i + 1][0]) i++;
    const [p0, a0, b0] = keyframes[i];
    const [p1, a1, b1] = keyframes[i + 1];
    const t = ease(seg(p, p0, p1));
    pos.set(lerp(a0[0], a1[0], t), lerp(a0[1], a1[1], t), lerp(a0[2], a1[2], t));
    tgt.set(lerp(b0[0], b1[0], t), lerp(b0[1], b1[1], t), lerp(b0[2], b1[2], t));
  }

  function bulletX(p) {
    if (p < 0.505) return CHAMBER_X;
    if (p < 0.555) return lerp(CHAMBER_X, MUZZLE_X - 0.5, easeIn(seg(p, 0.505, 0.555)));
    if (p < 0.63) return lerp(MUZZLE_X - 0.5, MUZZLE_X + 1.2, seg(p, 0.555, 0.63));
    return lerp(MUZZLE_X + 1.2, TARGET_X - 0.85, ease(seg(p, 0.63, 0.95)) * 0.15 + seg(p, 0.63, 0.95) * 0.85);
  }

  let width = 1, height = 1;
  function render(p) {
    p = clamp(p);
    const magY = lerp(MAG_OUT_Y, MAG_IN_Y, ease(seg(p, 0.14, 0.25)));
    magazine.position.y = magY - MAG_IN_Y;

    // X-ray: shell fades while the action is working
    const xray = ease(seg(p, 0.26, 0.31)) * (1 - ease(seg(p, 0.6, 0.66)));
    for (const m of shellMats) {
      m.opacity = 1 - 0.84 * xray;
      m.depthWrite = xray < 0.02;
    }

    // Bolt carrier and charging handle
    const off = carrierOffset(p);
    carrier.position.x = off;
    handle.position.x = -CARRIER_TRAVEL * (ease(seg(p, 0.30, 0.36)) - ease(seg(p, 0.37, 0.44)));
    const front = CARRIER_FRONT + off;

    // Hammer: forward (fired) → cocked by the carrier → falls → cocked again
    const cock1 = ease(seg(p, 0.30, 0.34));
    const fall = easeIn(seg(p, 0.48, 0.495));
    const cock2 = ease(seg(p, 0.538, 0.565));
    const cocked = clamp(cock1 - fall + cock2);
    hammer.rotation.z = lerp(-0.25, 1.2, cocked);
    trigger.rotation.z = 0.32 * (ease(seg(p, 0.45, 0.48)) - ease(seg(p, 0.64, 0.68)));
    pin.position.x = 0.07 * bump(p, 0.493, 0.53);

    // Magazine stack: rounds 1..4 start in the magazine, round 0 is pressed in on top.
    const pushed = ease(seg(p, 0.06, 0.12));
    const startX = magSlot(0, magY).x;
    const fed0 = p <= 0.36 ? 0 : p > 0.5 ? 1 : clamp((front - startX) / 0.4);
    const fed1 = p <= 0.58 ? 0 : clamp((front - startX) / 0.4);
    const raised = ease(clamp(fed0)) + ease(clamp(fed1));
    const stackShift = pushed - raised; // slots the stack is pushed down by

    // Round 0: loaded by hand, chambered, fired
    const r0 = rounds[0];
    if (p < 0.12) {
      const t = ease(seg(p, 0.0, 0.12));
      const slot = magSlot(0, magY);
      const s1 = ease(clamp(t / 0.6));
      place(r0, slot.x + (1 - s1) * 0.35, slot.y + lerp(1.1, 0.0, t), slot.z, (1 - s1) * -0.6);
    } else if (p < 0.36) {
      const slot = magSlot(0, magY);
      place(r0, slot.x, slot.y, slot.z);
    } else if (p < 0.505) {
      const f = feedPath(magSlot(0, magY), front);
      place(r0, f.x, f.y, f.z, f.tilt);
    } else {
      // Bullet leaves; case is extracted with the bolt face, then ejected
      const bx = bulletX(p);
      r0.b.position.set(bx - CHAMBER_X, BORE_Y, 0);
      r0.b.rotation.set(p * 900, 0, 0);
      const ejectAt = 0.552;
      if (p < ejectAt) {
        r0.c.position.set(Math.min(CHAMBER_X, front + 0.02) , BORE_Y, 0);
        r0.c.rotation.set(0, 0, 0);
      } else {
        const t = seg(p, ejectAt, 0.66);
        const startX = CARRIER_FRONT + carrierOffset(ejectAt) + 0.02;
        r0.c.position.set(startX - 0.6 * t, BORE_Y + 1.6 * t - 2.6 * t * t, 0.2 + 3.2 * t);
        r0.c.rotation.set(t * 6, t * 9, t * 4);
      }
    }
    r0.b.visible = !(p > 0.95);

    // Round 1: next in line; chambered during the second cycle
    const r1 = rounds[1];
    {
      const slot = magSlot(Math.max(stackShift, 0), magY);
      if (p > 0.58 && front > slot.x) {
        const f = feedPath(magSlot(0, magY), front);
        place(r1, f.x, f.y, f.z, f.tilt);
      } else place(r1, slot.x, slot.y, slot.z);
    }
    for (let i = 2; i < ROUNDS; i++) {
      const slot = magSlot(i - 1 + stackShift, magY);
      place(rounds[i], slot.x, slot.y, slot.z);
    }
    // Follower sits under the lowest round; the spring stretches from it to the floor plate.
    follower.position.y = magSlot(ROUNDS - 2 + stackShift, MAG_IN_Y).y - MAG_IN_Y - 0.075;
    spring.position.y = follower.position.y - 0.03;
    spring.scale.y = spring.position.y + 2.0;

    // Effects
    const ign = bump(p, 0.497, 0.53);
    chamberLight.intensity = 6 * ign * (0.3 + xray);
    const f = bump(p, 0.552, 0.585);
    flash.material.opacity = f;
    flash.scale.setScalar(0.3 + 1.6 * f);
    flashCones.forEach((c, i) => { c.material.opacity = f * (i === 0 ? 0.9 : 0.55); c.scale.set(0.4 + f * (i === 0 ? 1.6 : 0.9), 1, 1); });
    flashLight.intensity = 22 * f;
    const sm = seg(p, 0.555, 0.75);
    smoke.forEach(({ s, dx, dy, dz, size }) => {
      const t = Math.pow(sm, 0.6);
      s.position.set(MUZZLE_X + dx * t * 1.6, BORE_Y + dy * t + 0.4 * sm, dz * t);
      s.scale.setScalar(size * (0.2 + 1.4 * t));
      s.material.opacity = sm > 0 && sm < 1 ? 0.75 * Math.sin(Math.PI * Math.min(1, sm * 1.4)) : 0;
    });

    const bx = bulletX(p);
    const trailLen = clamp(bx - MUZZLE_X, 0, 7);
    trail.visible = p > 0.555 && p < 0.955 && trailLen > 0.05;
    trail.scale.set(trailLen, 1, 1);
    trail.position.set(bx + 0.35 - trailLen / 2, BORE_Y, 0);
    trailMat.opacity = 0.45 * (1 - seg(p, 0.9, 0.95));

    const hit = seg(p, 0.95, 1);
    plate.rotation.z = p > 0.95 ? -0.55 * Math.sin(hit * Math.PI * 1.6) * Math.exp(-hit * 1.2) : 0;
    spark.visible = p > 0.95;
    spark.position.set(TARGET_X - 0.1, BORE_Y, 0);
    spark.material.opacity = 1 - hit;
    spark.scale.setScalar(0.4 + 2.2 * Math.sqrt(hit));

    // Camera
    keyCam(p, camPos, camTarget);
    if (p > 0.63) {
      const follow = ease(seg(p, 0.63, 0.68));
      v3.set(bx - 1.5, 0.55, 1.25);
      camPos.lerp(v3, follow);
      camTarget.lerp(v3.set(bx + 1.4, BORE_Y, 0), follow);
      const end = ease(seg(p, 0.9, 1));
      camPos.lerp(v3.set(TARGET_X - 6.5, 1.3, 3.6), end);
      camTarget.lerp(v3.set(TARGET_X, 0.1, 0), end);
    }
    if (mobile || width < 700) {
      const k = width < height ? 1.75 : 1.3;
      camPos.sub(camTarget).multiplyScalar(k).add(camTarget);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    key.position.set(camTarget.x + 4, 7, 6);
    key.target.position.copy(camTarget);
    renderer.render(scene, camera);
  }

  let last = 0;
  function resize() {
    width = host.clientWidth || 1;
    height = host.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.25 : 1.75));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render(last);
  }
  const resizer = new ResizeObserver(resize);
  resizer.observe(host);
  resize();

  return {
    render(p) { last = p; render(p); },
    dispose() {
      resizer.disconnect();
      for (const item of disposables) item.dispose?.();
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach((color, i) => grad.addColorStop(i / (stops.length - 1), color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
