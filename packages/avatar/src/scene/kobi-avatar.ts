import * as THREE from 'three';

import { approach } from '../motion/approach.js';
import { Blinker } from '../motion/blinker.js';
import { floatPose } from '../motion/float-pose.js';
import { supersampleFactor } from '../motion/supersampling.js';
import { buildKobi, type KobiModel } from './kobi-model.js';
import type { BodyTone } from './palette.js';
import { createRenderer, lightStudio, type Studio } from './studio.js';

export interface KobiAvatarOptions {
  /** Canvas 2D visível onde a imagem final, já reduzida, é desenhada. */
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion?: boolean;
}

const INITIAL_TURN = -0.5;
const TURN_PER_PIXEL = 0.012;
const TURN_SMOOTHING = 0.08;

/**
 * O Kobi do protótipo v6. Renderiza com supersampling num canvas WebGL fora da
 * tela e reduz para o canvas visível com filtro de alta qualidade.
 *
 * Não tem laço de animação próprio: quem usa chama `render` com o tempo
 * decorrido, então a taxa de quadros é decidida fora daqui.
 */
export class KobiAvatar {
  private readonly output: CanvasRenderingContext2D;
  private readonly renderer = createRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private readonly model: KobiModel;
  private readonly studio: Studio;
  private readonly blinker: Blinker;
  private readonly reducedMotion: boolean;
  private targetTurn = INITIAL_TURN;
  private currentTurn = INITIAL_TURN;
  private dragging = false;
  private lastRenderAt: number | undefined;

  constructor({ canvas, reducedMotion = false }: KobiAvatarOptions) {
    const output = canvas.getContext('2d');
    if (!output) throw new Error('2D canvas unavailable');
    this.output = output;
    this.reducedMotion = reducedMotion;
    this.blinker = new Blinker(Math.random, reducedMotion);
    this.camera.position.set(0, 0.4, 11);
    this.camera.lookAt(0, 0.1, 0);
    this.studio = lightStudio(this.scene, this.renderer);
    this.model = buildKobi(
      this.scene,
      this.studio.environment,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
  }

  /** Tamanho em pixels CSS e a escala do monitor atual; chamar de novo ao mudar de monitor. */
  resize(width: number, height: number, devicePixelRatio: number): void {
    const canvas = this.output.canvas;
    canvas.width = Math.round(width * devicePixelRatio);
    canvas.height = Math.round(height * devicePixelRatio);
    const factor = supersampleFactor(canvas.width, canvas.height);
    this.renderer.setSize(canvas.width * factor, canvas.height * factor, false);
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 1 ? 42 : 30;
    this.camera.updateProjectionMatrix();
    this.output.imageSmoothingEnabled = true;
    this.output.imageSmoothingQuality = 'high';
  }

  render(elapsedSeconds: number): void {
    const delta = Math.max(0, elapsedSeconds - (this.lastRenderAt ?? elapsedSeconds));
    this.lastRenderAt = elapsedSeconds;

    const pose = floatPose(elapsedSeconds, this.reducedMotion);
    const { robot, eyes, wavingArm, restingArm, shadow } = this.model;
    const sway = this.dragging || this.reducedMotion ? 0 : pose.sway;
    this.currentTurn = approach(this.currentTurn, this.targetTurn + sway, delta, TURN_SMOOTHING);

    robot.position.y = pose.bob;
    robot.rotation.set(pose.pitch, this.currentTurn, pose.roll);
    wavingArm.rotation.z = pose.wavingArm;
    restingArm.rotation.z = pose.restingArm;
    eyes.scale.y = this.blinker.openness(elapsedSeconds);
    shadow.scale.set(pose.shadowScale, pose.shadowScale, 1);
    shadow.material.opacity = pose.shadowOpacity;

    this.renderer.render(this.scene, this.camera);
    const { canvas } = this.output;
    this.output.clearRect(0, 0, canvas.width, canvas.height);
    this.output.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
  }

  /** Gira o Kobi pelo arraste horizontal do usuário, em pixels. */
  turnBy(deltaPixels: number): void {
    this.targetTurn += deltaPixels * TURN_PER_PIXEL;
  }

  /** Enquanto o usuário gira o Kobi, o balanço automático para. */
  setDragging(dragging: boolean): void {
    this.dragging = dragging;
  }

  setLedColor(hex: string): void {
    this.model.setLedColor(hex);
  }

  setBodyTone(tone: BodyTone): void {
    this.model.setBodyTone(tone);
  }

  dispose(): void {
    this.model.dispose();
    this.studio.dispose();
    this.renderer.dispose();
  }
}
