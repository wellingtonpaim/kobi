export interface FloatPose {
  /** Deslocamento vertical da flutuação. */
  readonly bob: number;
  readonly roll: number;
  readonly pitch: number;
  /** Giro lento de um lado para o outro, somado ao giro do usuário. */
  readonly sway: number;
  readonly wavingArm: number;
  readonly restingArm: number;
  readonly shadowScale: number;
  readonly shadowOpacity: number;
}

/** Pose de flutuação do v6 em função só do tempo decorrido, em segundos. */
export const floatPose = (elapsedSeconds: number, reducedMotion: boolean): FloatPose => {
  const t = reducedMotion ? 0 : elapsedSeconds;
  const bob = Math.sin(t * 1.6) * 0.09;
  return {
    bob,
    roll: Math.sin(t * 1.1) * 0.025,
    pitch: Math.sin(t * 0.8) * 0.03,
    sway: Math.sin(t * 0.45) * 0.12,
    wavingArm: -1.05 + Math.sin(t * 6) * 0.25,
    restingArm: -0.36 + Math.sin(t * 1.6 + 1) * 0.05,
    shadowScale: 1 - bob * 0.9,
    shadowOpacity: 0.85 - bob * 1.5,
  };
};
