/** Inverte as linhas de uma imagem RGBA: o WebGL lê de baixo para cima, o canvas 2D de cima para baixo. */
export const flipRows = (pixels: Uint8Array, width: number, height: number): Uint8ClampedArray => {
  const rowBytes = width * 4;
  const flipped = new Uint8ClampedArray(pixels.length);
  for (let row = 0; row < height; row += 1) {
    const from = (height - 1 - row) * rowBytes;
    flipped.set(pixels.subarray(from, from + rowBytes), row * rowBytes);
  }
  return flipped;
};
