import * as THREE from 'three';

import { BODY_TONES, type BodyTone, DEFAULT_LED_COLOR, VISOR_COLOR } from './palette.js';

/** Altura da base do corpo em relação ao centro do robô: é o pivô da inclinação em pêndulo. */
export const BASE_HEIGHT = 1.88;

/** Partes animadas e materiais configuráveis do Kobi. */
export interface KobiModel {
  /** Fica na base do corpo; inclinar o pivô move a cabeça e mantém a base no lugar. */
  readonly pivot: THREE.Group;
  readonly robot: THREE.Group;
  readonly eyes: THREE.Group;
  readonly wavingArm: THREE.Group;
  readonly restingArm: THREE.Group;
  readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  setLedColor(hex: string): void;
  setBodyTone(tone: BodyTone): void;
  dispose(): void;
}

/** Microvariação de superfície (rugosidade e relevo), como no v6. */
const surfaceNoise = (maxAnisotropy: number): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.filter = 'blur(1.2px)';
  ctx.drawImage(canvas, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = maxAnisotropy;
  return texture;
};

const groundShadowTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(canvas);
};

const roundedRect = (w: number, h: number, r: number): THREE.Shape => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

const roundedBox = (
  w: number,
  h: number,
  d: number,
  r: number,
  bevel: number,
): THREE.ExtrudeGeometry => {
  const geometry = new THREE.ExtrudeGeometry(
    roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.02)),
    {
      depth: d - 2 * bevel,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 20,
      curveSegments: 48,
    },
  );
  geometry.center();
  return geometry;
};

/** Perfil do corpo em gota (v6), girado em torno do eixo vertical. */
const BODY_PROFILE: readonly (readonly [number, number])[] = [
  [0.001, -1.28],
  [0.36, -1.22],
  [0.66, -1.02],
  [0.86, -0.66],
  [0.93, -0.26],
  [0.9, 0.08],
  [0.78, 0.34],
  [0.52, 0.5],
  [0.001, 0.55],
];

export const buildKobi = (
  scene: THREE.Scene,
  environment: THREE.Texture,
  maxAnisotropy: number,
): KobiModel => {
  const noise = surfaceNoise(maxAnisotropy);
  const matte = (hex: string, envMapIntensity = 0.85): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
      color: hex,
      metalness: 0,
      roughness: 1,
      roughnessMap: noise,
      bumpMap: noise,
      bumpScale: 0.0012,
      envMap: environment,
      envMapIntensity,
    });

  const body = BODY_TONES.light;
  const shell = matte(body.shell);
  const trim = matte(body.trim);
  const seam = matte(body.seam, 0.6);
  const headset = matte(body.headset, 0.8);
  const accent = matte(DEFAULT_LED_COLOR, 0.7);
  const visor = new THREE.MeshStandardMaterial({
    color: VISOR_COLOR,
    roughness: 0.6,
    metalness: 0,
    envMap: environment,
    envMapIntensity: 0.18,
  });
  const led = new THREE.MeshBasicMaterial({ color: DEFAULT_LED_COLOR, toneMapped: false });

  const pivot = new THREE.Group();
  pivot.position.y = -BASE_HEIGHT;
  scene.add(pivot);
  const robot = new THREE.Group();
  robot.position.y = BASE_HEIGHT;
  pivot.add(robot);
  const add = <T extends THREE.Mesh>(
    mesh: T,
    parent: THREE.Object3D = robot,
    castShadow = true,
  ): T => {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Cabeça, moldura e visor
  add(new THREE.Mesh(roundedBox(2.2, 1.8, 1.7, 0.6, 0.32), shell)).position.y = 1.0;
  add(new THREE.Mesh(roundedBox(1.92, 1.42, 0.16, 0.5, 0.07), trim)).position.set(0, 0.98, 0.78);
  add(new THREE.Mesh(roundedBox(1.76, 1.26, 0.2, 0.42, 0.08), visor)).position.set(0, 0.98, 0.83);

  // Olhos de LED
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.98, 0.94);
  robot.add(eyes);
  const eyeGeometry = new THREE.TorusGeometry(0.17, 0.055, 32, 96, Math.PI);
  for (const x of [-0.38, 0.38]) {
    const eye = new THREE.Mesh(eyeGeometry, led);
    eye.position.x = x;
    eyes.add(eye);
  }

  // Pescoço
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.32, 96), trim)).position.y = 0.02;
  const neckRing = add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 20, 96), seam));
  neckRing.position.y = -0.12;
  neckRing.rotation.x = Math.PI / 2;

  // Corpo em gota e friso
  const profile = new THREE.SplineCurve(
    BODY_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
  ).getPoints(160);
  add(new THREE.Mesh(new THREE.LatheGeometry(profile, 192), shell)).position.y = -0.6;
  const belt = add(new THREE.Mesh(new THREE.TorusGeometry(0.912, 0.02, 16, 192), seam));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = -1.0;

  // Símbolo do peito
  const plate = add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 128), visor));
  plate.rotation.x = Math.PI / 2 - 0.12;
  plate.position.set(0, -0.48, 0.83);
  const chestRing = add(
    new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 32, 128), led),
    robot,
    false,
  );
  chestRing.position.set(0, -0.48, 0.865);
  chestRing.rotation.x = -0.12;
  add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 64, 64), led), robot, false).position.set(
    0,
    -0.48,
    0.86,
  );

  // Bracinhos
  const armGeometry = new THREE.SphereGeometry(0.22, 96, 96);
  const restingArm = new THREE.Group();
  restingArm.position.set(-0.86, -0.4, 0.05);
  robot.add(restingArm);
  const left = add(new THREE.Mesh(armGeometry, shell), restingArm);
  left.scale.set(1, 2.0, 1);
  left.position.y = -0.42;
  const wavingArm = new THREE.Group();
  wavingArm.position.set(0.86, -0.45, 0.05);
  robot.add(wavingArm);
  const right = add(new THREE.Mesh(armGeometry, shell), wavingArm);
  right.scale.set(1, 2.0, 1);
  right.position.y = 0.42;

  // Fone de ouvido e antena
  const band = add(new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.09, 32, 192, Math.PI), headset));
  band.position.y = 0.98;
  band.scale.y = 0.86;
  for (const side of [-1, 1]) {
    const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 128), headset));
    cup.rotation.z = Math.PI / 2;
    cup.position.set(side * 1.2, 0.95, 0);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.05, 24, 128), accent));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 1.36, 0.95, 0);
    const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 96), headset));
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * 1.36, 0.95, 0);
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 32), headset)).position.y = 2.2;
  add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 64, 64), led), robot, false).position.y = 2.4;

  // Sombra no chão
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({
      map: groundShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -2.35;
  scene.add(shadow);

  return {
    pivot,
    robot,
    eyes,
    wavingArm,
    restingArm,
    shadow,
    setLedColor(hex) {
      led.color.set(hex);
      accent.color.set(hex);
    },
    setBodyTone(tone) {
      const colors = BODY_TONES[tone];
      shell.color.set(colors.shell);
      trim.color.set(colors.trim);
      seam.color.set(colors.seam);
      headset.color.set(colors.headset);
    },
    dispose() {
      const disposed = new Set<{ dispose(): void }>();
      const release = (resource: { dispose(): void }): void => {
        if (!disposed.has(resource)) {
          disposed.add(resource);
          resource.dispose();
        }
      };
      for (const root of [robot, shadow]) {
        root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            release(object.geometry as THREE.BufferGeometry);
            release(object.material as THREE.Material);
          }
        });
      }
      release(noise);
      if (shadow.material.map) release(shadow.material.map);
      scene.remove(pivot, shadow);
    },
  };
};
