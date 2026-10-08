// SPDX-License-Identifier: GPL-2.0-or-later
// Só desenvolvimento: carregada apenas pela sessão aninhada de dev/nested-session.sh.
// Libera Eval e capturas de tela para os testes automáticos da extensão do Kobi.
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class UnsafeModeExtension extends Extension {
  enable() {
    this._previous = global.context.unsafe_mode;
    global.context.unsafe_mode = true;
  }

  disable() {
    global.context.unsafe_mode = this._previous;
  }
}
