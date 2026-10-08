// SPDX-License-Identifier: GPL-2.0-or-later
// Regras puras sobre os monitores (sem GNOME), testadas fora do gnome-shell.

/** Um valor de `a{sv}` pode vir já desempacotado ou ainda como GLib.Variant. */
const unpack = (value) => (typeof value?.unpack === 'function' ? value.unpack() : value);

/**
 * Taxa de atualização do modo em uso em cada conector, a partir do resultado
 * (desempacotado) de org.gnome.Mutter.DisplayConfig.GetCurrentState.
 */
export const currentRefreshRates = ([, monitors]) => {
  const rates = new Map();
  for (const [[connector], modes] of monitors) {
    const current = modes.find(([, , , , , , props]) => unpack(props['is-current']) === true);
    if (current) rates.set(connector, current[3]);
  }
  return rates;
};
