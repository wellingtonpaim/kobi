import * as THREE from 'three';

import { flipRows } from '../image/flip-rows.js';
import { approach } from '../motion/approach.js';
import { Blinker } from '../motion/blinker.js';
import { Dust } from '../motion/dust.js';
import { floatPose } from '../motion/float-pose.js';
import { supersampleFactor } from '../motion/supersampling.js';
import { blendTurn, Pendulum, travelHeading, type Velocity } from '../motion/travel.js';
import { type DustFrame, dustFrame, DustView } from './dust-view.js';
import { BASE_HEIGHT, buildKobi, type KobiModel } from './kobi-model.js';
import type { BodyTone } from './palette.js';
import { createRenderer, lightStudio, type Studio } from './studio.js';

export interface KobiAvatarOptions {
  /** Canvas 2D visível onde a imagem final, já reduzida, é desenhada. */
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion?: boolean;
}

const LOOK_AT_Y = 0.1;
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
  private travelVelocity: Velocity = { x: 0, y: 0 };
  private readonly pendulum: Pendulum;
  private readonly leanAxis = new THREE.Vector3();
  private readonly dust: Dust;
  private readonly dustView: DustView;
  /** Cópia minúscula da cena para saber onde o Kobi está visível, lida sem parar a animação. */
  private readonly coverageTarget = new THREE.WebGLRenderTarget(1, 1);
  private coveragePending = false;
  private dustFrame: DustFrame = {
    worldPerPixel: 0,
    bounds: { left: 0, right: 0, bottom: 0, top: 0 },
  };

  constructor({ canvas, reducedMotion = false }: KobiAvatarOptions) {
    const output = canvas.getContext('2d');
    if (!output) throw new Error('2D canvas unavailable');
    this.output = output;
    this.reducedMotion = reducedMotion;
    this.blinker = new Blinker(Math.random, reducedMotion);
    this.pendulum = new Pendulum(reducedMotion);
    this.dust = new Dust(Math.random, reducedMotion);
    this.camera.position.set(0, 0.4, 11);
    this.camera.lookAt(0, LOOK_AT_Y, 0);
    this.studio = lightStudio(this.scene, this.renderer);
    this.model = buildKobi(
      this.scene,
      this.studio.environment,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.dustView = new DustView(this.scene);
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
    this.dustFrame = dustFrame(this.camera, LOOK_AT_Y, height);
    this.output.imageSmoothingEnabled = true;
    this.output.imageSmoothingQuality = 'high';
  }

  render(elapsedSeconds: number): void {
    const delta = Math.max(0, elapsedSeconds - (this.lastRenderAt ?? elapsedSeconds));
    this.lastRenderAt = elapsedSeconds;

    const pose = floatPose(elapsedSeconds, this.reducedMotion);
    const { pivot, robot, eyes, wavingArm, restingArm, shadow } = this.model;
    const sway = this.dragging || this.reducedMotion ? 0 : pose.sway;
    const heading = travelHeading(this.travelVelocity);
    const turn = blendTurn(this.targetTurn + sway, heading.yaw, heading.weight);
    this.currentTurn = approach(this.currentTurn, turn, delta, TURN_SMOOTHING);
    const lean = this.pendulum.update(Math.abs(this.travelVelocity.x), delta);

    // Inclina em torno do eixo lateral do próprio Kobi, seja qual for o lado para onde está virado.
    this.leanAxis.set(Math.cos(this.currentTurn), 0, -Math.sin(this.currentTurn));
    pivot.quaternion.setFromAxisAngle(this.leanAxis, lean);
    robot.position.y = BASE_HEIGHT + pose.bob;
    robot.rotation.set(pose.pitch, this.currentTurn, pose.roll);
    wavingArm.rotation.z = pose.wavingArm;
    restingArm.rotation.z = pose.restingArm;
    eyes.scale.y = this.blinker.openness(elapsedSeconds);
    shadow.scale.set(pose.shadowScale, pose.shadowScale, 1);
    shadow.material.opacity = pose.shadowOpacity;
    this.dust.update(
      this.travelVelocity,
      delta,
      this.dustFrame.worldPerPixel,
      this.dustFrame.bounds,
    );
    this.dustView.sync(this.dust.puffs);

    this.renderer.render(this.scene, this.camera);
    const { canvas } = this.output;
    this.output.clearRect(0, 0, canvas.width, canvas.height);
    this.output.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
  }

  /**
   * Imagem RGBA (linhas de cima para baixo) do quadro recém-desenhado, reduzida a
   * `width` × `height`. A leitura é assíncrona (PBO + fence do WebGL2): ler o canvas
   * visível obrigaria a esperar a GPU e custava um quadro perdido a cada leitura.
   * Chamar logo depois de `render`; devolve `undefined` se outra leitura ainda está em curso.
   */
  sampleCoverage(width: number, height: number): Promise<Uint8ClampedArray> | undefined {
    if (this.coveragePending) return undefined;
    this.coveragePending = true;
    this.coverageTarget.setSize(width, height);
    this.renderer.setRenderTarget(this.coverageTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    const pixels = new Uint8Array(width * height * 4);
    return this.renderer
      .readRenderTargetPixelsAsync(this.coverageTarget, 0, 0, width, height, pixels)
      .then(() => flipRows(pixels, width, height))
      .finally(() => {
        this.coveragePending = false;
      });
  }

  /**
   * Velocidade com que o Kobi está se deslocando na tela, em pixels CSS por
   * segundo (y para baixo). Ele vira para onde vai e inclina como um pêndulo.
   */
  setTravelVelocity(velocity: Velocity): void {
    this.travelVelocity = velocity;
  }

  /**
   * Parado e sem poeira no ar: a imagem só muda devagar (flutuação, braços).
   * Em movimento, a poeira pode surgir em qualquer ponto da janela a qualquer momento.
   */
  get settled(): boolean {
    return (
      Math.hypot(this.travelVelocity.x, this.travelVelocity.y) < 1 && this.dust.puffs.length === 0
    );
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
    this.dustView.dispose(this.scene);
    this.studio.dispose();
    this.coverageTarget.dispose();
    this.renderer.dispose();
  }
}
