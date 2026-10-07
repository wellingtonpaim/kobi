import * as THREE from 'three';

import { Dust, type DustBounds, type Puff } from '../motion/dust.js';

/** Altura do chão (onde fica a sombra) na cena: a poeira nasce ali. */
const GROUND_Y = -2.35;
/** Um pouco à frente da base, para a poeira não sumir atrás do corpo. */
const DEPTH = 0.6;
const DUST_COLOR = '#b3aa9c';

const softPuffTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
};

export interface DustFrame {
  /** Quanto um pixel CSS mede no plano da poeira. */
  readonly worldPerPixel: number;
  readonly bounds: DustBounds;
}

/**
 * Limites da janela no plano onde a poeira é desenhada, a partir do ponto do chão.
 * Esse plano fica mais perto da câmera que o centro da cena, então a janela "cabe"
 * menos ali: medir no plano certo é o que impede a poeira de passar da borda.
 */
export const dustFrame = (
  camera: THREE.PerspectiveCamera,
  lookAtY: number,
  cssHeight: number,
): DustFrame => {
  const distance = camera.position.z - DEPTH;
  const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfWidth = halfHeight * camera.aspect;
  const centerY =
    camera.position.y + ((lookAtY - camera.position.y) * distance) / camera.position.z;
  return {
    worldPerPixel: (2 * halfHeight) / cssHeight,
    bounds: {
      left: -halfWidth,
      right: halfWidth,
      bottom: centerY - halfHeight - GROUND_Y,
      top: centerY + halfHeight - GROUND_Y,
    },
  };
};

/** Desenha a poeira com um conjunto fixo de sprites, sem criar objetos a cada quadro. */
export class DustView {
  private readonly texture = softPuffTexture();
  private readonly sprites: THREE.Sprite[];

  constructor(scene: THREE.Scene) {
    this.sprites = Array.from({ length: Dust.capacity }, () => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.texture,
          color: DUST_COLOR,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sprite.visible = false;
      scene.add(sprite);
      return sprite;
    });
  }

  sync(puffs: readonly Puff[]): void {
    this.sprites.forEach((sprite, i) => {
      const puff = puffs[i];
      sprite.visible = puff !== undefined && puff.opacity > 0;
      if (!puff) return;
      sprite.position.set(puff.x, GROUND_Y + puff.y, DEPTH);
      sprite.scale.setScalar(puff.size);
      sprite.material.opacity = puff.opacity;
    });
  }

  dispose(scene: THREE.Scene): void {
    for (const sprite of this.sprites) {
      sprite.material.dispose();
      scene.remove(sprite);
    }
    this.texture.dispose();
  }
}
