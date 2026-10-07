import * as THREE from 'three';

/**
 * Iluminação de estúdio do v6: ambiente de softboxes pré-calculado (PMREM),
 * luz principal com sombra suave e preenchimento hemisférico.
 *
 * Diferenças em relação ao three.js r128 do protótipo, compensadas aqui:
 * - as luzes usam unidades físicas (r155): intensidades multiplicadas por π;
 * - cores em hex passam a ser convertidas de sRGB (r152), mas o r128 usava o hex
 *   das luzes cru, como valor linear: `asInR128` mantém esse comportamento;
 * - com `scene.environment`, o `envMapIntensity` de cada material é ignorado (r163).
 *   O mapa de ambiente é devolvido para ser aplicado direto em cada material,
 *   que assim mantém a intensidade de reflexo aprovada no v6.
 */
const LEGACY_TO_PHYSICAL = Math.PI;

const asInR128 = (hex: number): THREE.Color =>
  new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

export const createRenderer = (): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
};

/** Softboxes do v6: largura, altura, posição (x, y, z) e cor linear (r, g, b), acima de 1 para brilhar. */
const SOFTBOXES: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [16, 16, -1, 11, 3, 1.7, 1.7, 1.7],
  [12, 14, -10, 3, 6, 1.15, 1.15, 1.18],
  [10, 14, 10, 2, 5, 0.6, 0.62, 0.68],
  [12, 6, 0, -6, 10, 0.35, 0.35, 0.35],
  [10, 12, 4, 3, -11, 0.5, 0.55, 0.65],
];

const environmentScene = (): THREE.Scene => {
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(24, 24, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.16, 0.165, 0.175),
        side: THREE.BackSide,
      }),
    ),
  );
  for (const [w, h, x, y, z, r, g, b] of SOFTBOXES) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }),
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    env.add(panel);
  }
  return env;
};

export interface Studio {
  readonly environment: THREE.Texture;
  dispose(): void;
}

export const lightStudio = (scene: THREE.Scene, renderer: THREE.WebGLRenderer): Studio => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = environmentScene();
  const target = pmrem.fromScene(env, 0.06);
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      (o.geometry as THREE.BufferGeometry).dispose();
      (o.material as THREE.Material).dispose();
    }
  });

  const key = new THREE.DirectionalLight(asInR128(0xfff5ea), 0.9 * LEGACY_TO_PHYSICAL);
  key.position.set(-4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = 7;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, {
    left: -3.2,
    right: 3.2,
    top: 3.2,
    bottom: -3.2,
    near: 1,
    far: 22,
  });
  scene.add(key);
  scene.add(
    new THREE.HemisphereLight(asInR128(0xe8edf5), asInR128(0x2a2623), 0.22 * LEGACY_TO_PHYSICAL),
  );

  return {
    environment: target.texture,
    dispose: () => {
      target.dispose();
    },
  };
};
