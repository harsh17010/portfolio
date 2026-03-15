/* ============================================================
   Space Portfolio — Solar System (Three.js r134)
   ============================================================ */

(function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────────────────────── */
  const canvas       = document.getElementById('solar-canvas');
  const loadScreen   = document.getElementById('loading-screen');
  const tooltip      = document.getElementById('planet-tooltip');
  const backBtn      = document.getElementById('back-btn');
  const contentPanel = document.getElementById('content-panel');
  const closePanel   = document.getElementById('close-panel');
  const panelContent = document.getElementById('panel-content');
  const navHint      = document.getElementById('nav-hint');

  /* ── Three.js core ────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 120, 280);
  camera.lookAt(0, 0, 0);

  /* ── Planet data ──────────────────────────────────────────── */
  const PLANETS = [
    {
      id: 'sun',      name: 'Sun',     templateId: 'section-home',
      radius: 18,     orbitR: 0,       speed: 0,       color: 0xffdd55,
      emissive: 0xffaa00, emissiveIntensity: 1.4,
      tilt: 0,        moons: []
    },
    {
      id: 'mercury',  name: 'Mercury', templateId: 'section-mercury',
      radius: 3.2,    orbitR: 42,      speed: 1.607,   color: 0xb5b5b5,
      emissive: 0x333333, emissiveIntensity: 0.1,
      tilt: 0.03,     moons: []
    },
    {
      id: 'venus',    name: 'Venus',   templateId: 'section-venus',
      radius: 5.5,    orbitR: 62,      speed: 1.174,   color: 0xe8cda0,
      emissive: 0x4a3010, emissiveIntensity: 0.25,
      tilt: 0.05,     moons: []
    },
    {
      id: 'earth',    name: 'Earth',   templateId: 'section-earth',
      radius: 6,      orbitR: 86,      speed: 1.0,     color: 0x2255aa,
      emissive: 0x001133, emissiveIntensity: 0.08,
      tilt: 0.41,     moons: [{ r: 1.5, orbitR: 11, speed: 4, color: 0xbbbbbb }]
    },
    {
      id: 'mars',     name: 'Mars',    templateId: 'section-mars',
      radius: 4.8,    orbitR: 114,     speed: 0.802,   color: 0xcc4400,
      emissive: 0x330800, emissiveIntensity: 0.15,
      tilt: 0.44,     moons: []
    },
    {
      id: 'jupiter',  name: 'Jupiter', templateId: 'section-jupiter',
      radius: 14,     orbitR: 165,     speed: 0.434,   color: 0xd4a96a,
      emissive: 0x2a1500, emissiveIntensity: 0.05,
      tilt: 0.05,     moons: [
        { r: 1.2, orbitR: 20, speed: 3.5,  color: 0xbbaa88 },
        { r: 1.0, orbitR: 26, speed: 2.4,  color: 0xaaaaaa }
      ]
    },
    {
      id: 'saturn',   name: 'Saturn',  templateId: 'section-saturn',
      radius: 12,     orbitR: 218,     speed: 0.323,   color: 0xe4d49b,
      emissive: 0x1a1000, emissiveIntensity: 0.05,
      tilt: 0.47,     moons: [], hasRing: true
    },
    {
      id: 'neptune',  name: 'Neptune', templateId: 'section-neptune',
      radius: 7.5,    orbitR: 275,     speed: 0.182,   color: 0x3355cc,
      emissive: 0x000c33, emissiveIntensity: 0.2,
      tilt: 0.49,     moons: []
    }
  ];

  /* ── State ────────────────────────────────────────────────── */
  let planetMeshes       = [];   // { mesh, data, orbitGroup, angle }
  let isFocused          = false;
  let focusedPlanet      = null;
  let isAnimatingCamera  = false;

  /* Camera drag state */
  let isDragging     = false;
  let prevMouse      = { x: 0, y: 0 };
  let orbitAngles    = { theta: 0, phi: 0.4 };  // spherical coords
  let orbitDist      = 280;
  const TARGET_DIST_DEFAULT = 280;
  let orbitTarget    = new THREE.Vector3(0, 0, 0);
  let camVelocity    = { theta: 0, phi: 0 };

  /* ── Lighting ─────────────────────────────────────────────── */
  function addLights() {
    // Sun point light
    const sunLight = new THREE.PointLight(0xffeedd, 3, 1800, 1.2);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Ambient for dark side visibility
    const ambient = new THREE.AmbientLight(0x111133, 0.6);
    scene.add(ambient);

    // Subtle blue fill from camera side
    const fillLight = new THREE.DirectionalLight(0x224488, 0.35);
    fillLight.position.set(100, 80, 150);
    scene.add(fillLight);
  }

  /* ── Starfield ────────────────────────────────────────────── */
  function createStarfield() {
    const count    = 8000;
    const geo      = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r     = 600 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const warm = Math.random() > 0.7;
      if (warm) {
        colors[i * 3]     = 1.0;
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
      } else {
        colors[i * 3]     = 0.7 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 2] = 1.0;
      }
      sizes[i] = 0.6 + Math.random() * 1.4;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    scene.add(new THREE.Points(geo, mat));
  }

  /* ── Nebula ───────────────────────────────────────────────── */
  function createNebula() {
    const count  = 800;
    const geo    = new THREE.BufferGeometry();
    const pos    = new Float32Array(count * 3);
    const col    = new Float32Array(count * 3);

    const hues = [
      [0.15, 0.05, 0.4],   // purple
      [0.0,  0.05, 0.3],   // dark blue
      [0.3,  0.0,  0.2]    // deep rose
    ];

    for (let i = 0; i < count; i++) {
      const r     = 400 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi   = (Math.random() - 0.5) * Math.PI * 0.5;
      pos[i * 3]     = r * Math.cos(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);

      const h = hues[Math.floor(Math.random() * hues.length)];
      col[i * 3]     = h[0] + Math.random() * 0.1;
      col[i * 3 + 1] = h[1] + Math.random() * 0.05;
      col[i * 3 + 2] = h[2] + Math.random() * 0.2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 22,
      vertexColors: true,
      transparent: true,
      opacity: 0.08,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    scene.add(new THREE.Points(geo, mat));
  }

  /* ── Orbit Rings ──────────────────────────────────────────── */
  function createOrbitRing(r) {
    const pts = [];
    const SEG = 128;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.3
    });
    return new THREE.Line(geo, mat);
  }

  /* ── Saturn Ring ──────────────────────────────────────────── */
  function createSaturnRing(planet) {
    const innerR = planet.radius * 1.35;
    const outerR = planet.radius * 2.3;
    const geo    = new THREE.RingGeometry(innerR, outerR, 64);
    const mat    = new THREE.MeshBasicMaterial({
      color: 0xd4c08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const ring   = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2.5;
    return ring;
  }

  /* ── Procedural planet texture ────────────────────────────── */
  function makePlanetTexture(baseColor, variation) {
    const size = 256;
    const cvs  = document.createElement('canvas');
    cvs.width  = size;
    cvs.height = size;
    const ctx  = cvs.getContext('2d');

    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8)  & 0xff;
    const b =  baseColor        & 0xff;

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, size, size);

    // Add noise bands
    for (let i = 0; i < 18; i++) {
      const y     = Math.random() * size;
      const h     = 4 + Math.random() * 20;
      const alpha = 0.03 + Math.random() * 0.12;
      const dr    = (Math.random() - 0.5) * variation;
      const dg    = (Math.random() - 0.5) * variation;
      const db    = (Math.random() - 0.5) * variation;
      ctx.fillStyle = `rgba(${Math.round(r + dr)},${Math.round(g + dg)},${Math.round(b + db)},${alpha})`;
      ctx.fillRect(0, y, size, h);
    }

    // Random craters / spots
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = 3 + Math.random() * 14;
      const alpha = 0.04 + Math.random() * 0.1;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, s);
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cvs);
    return tex;
  }

  /* ── Sun glow sprite ──────────────────────────────────────── */
  function createSunGlow(radius) {
    const size = 512;
    const cvs  = document.createElement('canvas');
    cvs.width  = size; cvs.height = size;
    const ctx  = cvs.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, radius * 0.4,
                                           size/2, size/2, size/2);
    grad.addColorStop(0,   'rgba(255,240,120,0.9)');
    grad.addColorStop(0.15,'rgba(255,200,60,0.55)');
    grad.addColorStop(0.4, 'rgba(255,140,0,0.18)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cvs),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(radius * 8, radius * 8, 1);
    return sprite;
  }

  /* ── Planet glow sprite ───────────────────────────────────── */
  function createPlanetGlow(radius, color) {
    const size = 256;
    const cvs  = document.createElement('canvas');
    cvs.width  = size; cvs.height = size;
    const ctx  = cvs.getContext('2d');
    const cx   = size / 2;

    const r = (color >> 16) & 0xff;
    const g = (color >> 8)  & 0xff;
    const b =  color        & 0xff;

    const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0.3, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},0.06)`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const mat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cvs),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(radius * 4.5, radius * 4.5, 1);
    return sprite;
  }

  /* ── Build Solar System ───────────────────────────────────── */
  function buildSolarSystem() {
    PLANETS.forEach((data, idx) => {
      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);

      // Orbit ring (skip sun)
      if (data.orbitR > 0) {
        scene.add(createOrbitRing(data.orbitR));
      }

      // Planet mesh
      const geo = new THREE.SphereGeometry(data.radius, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        map: makePlanetTexture(data.color, 60),
        roughness:  0.75,
        metalness:  0.05,
        emissive:   new THREE.Color(data.emissive),
        emissiveIntensity: data.emissiveIntensity
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.rotation.z    = data.tilt;
      mesh.userData      = { planetIdx: idx, type: 'planet' };
      orbitGroup.add(mesh);

      // Glow
      if (data.id === 'sun') {
        scene.add(createSunGlow(data.radius));
      } else {
        mesh.add(createPlanetGlow(data.radius, data.color));
      }

      // Saturn ring
      if (data.hasRing) {
        mesh.add(createSaturnRing(data));
      }

      // Moons
      data.moons.forEach(m => {
        const mGroup = new THREE.Group();
        const mGeo   = new THREE.SphereGeometry(m.r, 20, 20);
        const mMat   = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.8 });
        const mMesh  = new THREE.Mesh(mGeo, mMat);
        mMesh.position.x = m.orbitR;
        mGroup.add(mMesh);
        mesh.add(mGroup);
        m._group = mGroup;
      });

      // Initial orbit angle spread
      const angle = idx * ((Math.PI * 2) / PLANETS.length);
      mesh.position.x = data.orbitR * Math.cos(angle);
      mesh.position.z = data.orbitR * Math.sin(angle);

      planetMeshes.push({ mesh, data, orbitGroup, angle });
    });
  }

  /* ── Asteroid Belt ────────────────────────────────────────── */
  function buildAsteroidBelt() {
    const count   = 600;
    const geo     = new THREE.BufferGeometry();
    const pos     = new Float32Array(count * 3);
    const col     = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r     = 136 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      const y     = (Math.random() - 0.5) * 4;
      pos[i * 3]     = r * Math.cos(angle);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = r * Math.sin(angle);
      const shade = 0.35 + Math.random() * 0.35;
      col[i * 3]     = shade;
      col[i * 3 + 1] = shade * 0.92;
      col[i * 3 + 2] = shade * 0.85;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true
    });
    const belt = new THREE.Points(geo, mat);
    belt.userData.isBelt = true;
    scene.add(belt);
    return belt;
  }

  /* ── Shooting Stars ───────────────────────────────────────── */
  const shootingStars = [];

  function spawnShootingStar() {
    const startR   = 500;
    const startTheta = Math.random() * Math.PI * 2;
    const startPhi   = (Math.random() - 0.5) * Math.PI;

    const start = new THREE.Vector3(
      startR * Math.cos(startPhi) * Math.cos(startTheta),
      startR * Math.sin(startPhi) * 0.4,
      startR * Math.cos(startPhi) * Math.sin(startTheta)
    );
    const end = start.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 180,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 180
      )
    );

    const pts  = [start, end];
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    shootingStars.push({ line, mat, elapsed: 0, duration: 0.7 + Math.random() * 0.8 });
  }

  let shootingStarTimer = 0;

  function updateShootingStars(dt) {
    shootingStarTimer += dt;
    if (shootingStarTimer > 2.5 + Math.random() * 3) {
      spawnShootingStar();
      shootingStarTimer = 0;
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.elapsed += dt;
      s.mat.opacity = 0.9 * (1 - s.elapsed / s.duration);
      if (s.elapsed >= s.duration) {
        scene.remove(s.line);
        s.line.geometry.dispose();
        s.line.material.dispose();
        shootingStars.splice(i, 1);
      }
    }
  }

  /* ── Raycasting / Interaction ─────────────────────────────── */
  const raycaster  = new THREE.Raycaster();
  const mouse      = new THREE.Vector2(-999, -999);
  let   hoveredIdx = -1;

  function onMouseMove(e) {
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top  = (e.clientY - 10) + 'px';
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    prevMouse  = { x: e.clientX, y: e.clientY };
  }

  function onMouseUp(e) {
    isDragging = false;
  }

  function onClick(e) {
    // Small move threshold — ignore drags
    if (Math.abs(e.clientX - prevMouse.x) > 5 || Math.abs(e.clientY - prevMouse.y) > 5) return;

    raycaster.setFromCamera(
      new THREE.Vector2(
         (e.clientX / window.innerWidth)  * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      ),
      camera
    );

    const meshes = planetMeshes.map(p => p.mesh);
    const hits   = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.planetIdx;
      focusPlanet(idx);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    if (isFocused) return;
    orbitDist = Math.max(80, Math.min(500, orbitDist + e.deltaY * 0.15));
  }

  /* Touch support */
  let touchStart = null;
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isDragging = true;
      prevMouse  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onTouchMove(e) {
    if (e.touches.length !== 1 || !isDragging) return;
    const dx = e.touches[0].clientX - prevMouse.x;
    const dy = e.touches[0].clientY - prevMouse.y;
    orbitAngles.theta -= dx * 0.006;
    orbitAngles.phi    = Math.max(-1.0, Math.min(1.0, orbitAngles.phi + dy * 0.006));
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e) {
    isDragging = false;
  }

  /* ── Focus / Unfocus planet ───────────────────────────────── */
  function focusPlanet(idx) {
    if (isAnimatingCamera) return;
    isFocused     = true;
    focusedPlanet = idx;
    isAnimatingCamera = true;

    navHint.classList.add('hidden');
    backBtn.classList.remove('hidden');

    const { mesh, data } = planetMeshes[idx];
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    const offset    = data.radius * 4.2;
    const targetCam = worldPos.clone().add(new THREE.Vector3(offset, offset * 0.5, offset));

    // GSAP tween camera
    gsap.to(camera.position, {
      x: targetCam.x,
      y: targetCam.y,
      z: targetCam.z,
      duration: 1.8,
      ease: 'power3.inOut',
      onUpdate: () => { camera.lookAt(worldPos); },
      onComplete: () => {
        isAnimatingCamera = false;
        showContentPanel(data);
      }
    });
  }

  function resetCamera() {
    if (isAnimatingCamera) return;
    isAnimatingCamera = true;
    isFocused         = false;
    focusedPlanet     = null;

    closeContentPanel();
    backBtn.classList.add('hidden');
    navHint.classList.remove('hidden');

    gsap.to(camera.position, {
      x: 0, y: 120, z: 280,
      duration: 1.6,
      ease: 'power3.inOut',
      onUpdate: () => { camera.lookAt(0, 0, 0); orbitTarget.set(0, 0, 0); },
      onComplete: () => {
        isAnimatingCamera = false;
        orbitAngles = { theta: 0, phi: 0.4 };
        orbitDist   = TARGET_DIST_DEFAULT;
      }
    });
  }

  /* ── Content Panel ────────────────────────────────────────── */
  function showContentPanel(data) {
    const tpl = document.getElementById(data.templateId);
    if (!tpl) return;
    panelContent.innerHTML = tpl.innerHTML;
    contentPanel.classList.remove('hidden');
  }

  function closeContentPanel() {
    contentPanel.classList.add('hidden');
    panelContent.innerHTML = '';
  }

  /* ── Hover detection ──────────────────────────────────────── */
  function updateHover() {
    raycaster.setFromCamera(mouse, camera);
    const meshes = planetMeshes.map(p => p.mesh);
    const hits   = raycaster.intersectObjects(meshes);

    if (hits.length > 0) {
      const idx = hits[0].object.userData.planetIdx;
      if (idx !== hoveredIdx) {
        hoveredIdx = idx;
        tooltip.textContent = planetMeshes[idx].data.name;
        tooltip.classList.add('visible');
        canvas.style.cursor = 'pointer';
      }
    } else {
      if (hoveredIdx !== -1) {
        hoveredIdx = -1;
        tooltip.classList.remove('visible');
        canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    }
  }

  /* ── Camera drag update ───────────────────────────────────── */
  function updateCameraDrag(e) {
    if (!isDragging || isFocused) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    camVelocity.theta = dx * 0.006;
    camVelocity.phi   = dy * 0.006;
    orbitAngles.theta -= camVelocity.theta;
    orbitAngles.phi    = Math.max(-1.0, Math.min(1.0, orbitAngles.phi + camVelocity.phi));
    prevMouse = { x: e.clientX, y: e.clientY };
  }

  function applyOrbitCamera() {
    if (isFocused || isAnimatingCamera) return;
    // Inertia
    orbitAngles.theta -= camVelocity.theta * 0.88;
    orbitAngles.phi    = Math.max(-1.0, Math.min(1.0,
      orbitAngles.phi + camVelocity.phi * 0.88));
    if (!isDragging) {
      camVelocity.theta *= 0.88;
      camVelocity.phi   *= 0.88;
    }

    camera.position.x = orbitTarget.x + orbitDist * Math.cos(orbitAngles.phi) * Math.sin(orbitAngles.theta);
    camera.position.y = orbitTarget.y + orbitDist * Math.sin(orbitAngles.phi);
    camera.position.z = orbitTarget.z + orbitDist * Math.cos(orbitAngles.phi) * Math.cos(orbitAngles.theta);
    camera.lookAt(orbitTarget);
  }

  /* ── Belt rotation ────────────────────────────────────────── */
  let belt;

  /* ── Animation loop ───────────────────────────────────────── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const dt   = clock.getDelta();
    const time = clock.getElapsedTime();

    // Planet orbits
    planetMeshes.forEach(p => {
      if (p.data.orbitR === 0) {
        // Sun self-rotation
        p.mesh.rotation.y += 0.003;
        return;
      }
      p.angle += dt * p.data.speed * 0.18;
      p.mesh.position.x = p.data.orbitR * Math.cos(p.angle);
      p.mesh.position.z = p.data.orbitR * Math.sin(p.angle);
      p.mesh.rotation.y += dt * 0.3;

      // Moon orbit
      p.data.moons.forEach(m => {
        if (!m._group) return;
        m._group.rotation.y += dt * m.speed * 0.5;
      });
    });

    // Asteroid belt slow spin
    if (belt) belt.rotation.y += dt * 0.01;

    updateShootingStars(dt);
    applyOrbitCamera();
    updateHover();

    renderer.render(scene, camera);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    addLights();
    createStarfield();
    createNebula();
    buildSolarSystem();
    belt = buildAsteroidBelt();

    // Events
    window.addEventListener('mousemove', e => { onMouseMove(e); updateCameraDrag(e); });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('click',     onClick);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true });

    backBtn.addEventListener('click',  resetCamera);
    closePanel.addEventListener('click', () => {
      closeContentPanel();
      resetCamera();
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Remove loading screen
    setTimeout(() => {
      loadScreen.classList.add('fade-out');
      setTimeout(() => { loadScreen.style.display = 'none'; }, 900);
    }, 1400);

    animate();
  }

  init();

  /* ── Contact form helper (global) ────────────────────────── */
  window.handleContactForm = function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-send');
    btn.textContent = '✓ Sent!';
    btn.style.background = 'linear-gradient(135deg, #a5d6a7, #66bb6a)';
    setTimeout(() => {
      btn.textContent = 'Send Message 🚀';
      btn.style.background = '';
      e.target.reset();
    }, 3000);
  };

})();
