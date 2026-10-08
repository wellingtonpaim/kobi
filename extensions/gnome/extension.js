// SPDX-License-Identifier: GPL-2.0-or-later
// Kobi Overlay: no Wayland, só o compositor posiciona janelas e as mantém acima.
// Esta extensão faz isso pela janela do Kobi, e apenas por ela (spec 0002, estratégia B).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { currentRefreshRates } from './monitors.js';
import { pointerInRegions } from './region.js';

Gio._promisify(Gio.DBusConnection.prototype, 'call');

const BUS_NAME = 'io.github.wellingtonpaim.Kobi.Overlay';
const OBJECT_PATH = '/io/github/wellingtonpaim/Kobi/Overlay';
const INTERFACE = `
<node>
  <interface name="${BUS_NAME}">
    <!-- Move a janela do Kobi de quem chama, sem as restrições de janela comum
         (quem mantém o Kobi visível é o app). false se a janela não existe. -->
    <method name="MoveTo">
      <arg type="i" name="x" direction="in"/>
      <arg type="i" name="y" direction="in"/>
      <arg type="b" name="moved" direction="out"/>
    </method>
    <!-- Retângulo da janela do Kobi de quem chama, em pixels lógicos globais. -->
    <method name="GetFrame">
      <arg type="b" name="found" direction="out"/>
      <arg type="(iiii)" name="frame" direction="out"/>
    </method>
    <!-- Posição global do ponteiro (no Wayland o app só a conhece dentro da janela). -->
    <method name="GetPointer">
      <arg type="(ii)" name="pointer" direction="out"/>
    </method>
    <!-- Áreas da janela (relativas a ela) onde o Kobi recebe o mouse. A partir daí,
         PointerInside avisa quem chamou sempre que o ponteiro entra ou sai delas. -->
    <method name="SetInteractiveRegion">
      <arg type="a(iiii)" name="regions" direction="in"/>
      <arg type="b" name="found" direction="out"/>
    </method>
    <signal name="PointerInside">
      <arg type="b" name="inside"/>
    </signal>
    <!-- Monitores como o GNOME os vê, o que o Electron não sabe no Wayland: conector,
         geometria e área útil (sem o painel) em pixels lógicos, escala, taxa de
         atualização (0 se desconhecida) e se é o principal. -->
    <method name="GetMonitors">
      <arg type="a(s(iiii)(iiii)ddb)" name="monitors" direction="out"/>
    </method>
    <!-- Monitores, escala, disposição ou área útil mudaram. -->
    <signal name="MonitorsChanged"/>
    <property name="Version" type="u" access="read"/>
  </interface>
</node>`;
const VERSION = 2;

/** app_id da janela do Kobi no Wayland (vem do `desktopName` do app). */
const KOBI_APP_ID = 'io.github.wellingtonpaim.Kobi';

const isKobi = (window) => window.get_wm_class() === KOBI_APP_ID;

/**
 * Já mostrada e posicionada pelo compositor (mesmo com a Visão geral aberta). Antes
 * disso, o posicionamento inicial do Mutter passaria por cima do movimento pedido.
 */
const isOnScreen = (window) => window.mapped;

export default class KobiOverlayExtension extends Extension {
  enable() {
    /** PID de cada remetente D-Bus; nomes únicos nunca são reaproveitados. */
    this._pids = new Map();
    /** Janelas ainda sem app_id sendo observadas; soltas no disable. */
    this._watches = new Set();
    /** Quem recebe PointerInside: { sender, window, regions, inside, unmanagingId }. */
    this._listener = null;
    this._cursorId = 0;
    this._service = Gio.DBusExportedObject.wrapJSObject(INTERFACE, this);
    this._service.export(Gio.DBus.session, OBJECT_PATH);
    this._nameId = Gio.bus_own_name_on_connection(
      Gio.DBus.session,
      BUS_NAME,
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
    );
    this._windowCreatedId = global.display.connect('window-created', (_, window) => {
      this._watch(window);
    });
    for (const actor of global.get_window_actors()) this._watch(actor.get_meta_window());
    const monitorsChanged = () => this._service.emit_signal('MonitorsChanged', null);
    this._monitorsChangedId = global.backend
      .get_monitor_manager()
      .connect('monitors-changed', monitorsChanged);
    this._workareasChangedId = global.display.connect('workareas-changed', monitorsChanged);
  }

  disable() {
    global.backend.get_monitor_manager().disconnect(this._monitorsChangedId);
    global.display.disconnect(this._workareasChangedId);
    global.display.disconnect(this._windowCreatedId);
    for (const stop of [...this._watches]) stop();
    this._stopListening();
    Gio.bus_unown_name(this._nameId);
    this._service.unexport();
    this._service = null;
    this._watches = null;
    this._pids = null;
  }

  get Version() {
    return VERSION;
  }

  MoveToAsync([x, y], invocation) {
    this._reply(invocation, '(b)', async () => {
      const window = await this._callerWindow(invocation);
      if (!window) return [false];
      // Como operação do usuário, o Mutter não força a janela a caber inteira na tela.
      window.move_frame(true, x, y);
      this._updatePointer();
      return [true];
    });
  }

  GetFrameAsync(_, invocation) {
    this._reply(invocation, '(b(iiii))', async () => {
      const rect = (await this._callerWindow(invocation))?.get_frame_rect();
      return rect ? [true, [rect.x, rect.y, rect.width, rect.height]] : [false, [0, 0, 0, 0]];
    });
  }

  GetPointer() {
    const [x, y] = global.get_pointer();
    return [x, y];
  }

  SetInteractiveRegionAsync([regions], invocation) {
    this._reply(invocation, '(b)', async () => {
      const window = await this._callerWindow(invocation);
      if (!window) return [false];
      const sender = invocation.get_sender();
      if (this._listener?.sender !== sender || this._listener.window !== window)
        this._listen(sender, window);
      this._listener.regions = regions;
      this._updatePointer();
      return [true];
    });
  }

  GetMonitorsAsync(_, invocation) {
    this._reply(invocation, '(a(s(iiii)(iiii)ddb))', async () => {
      const rates = await this._refreshRates();
      const display = global.display;
      const workspace = global.workspace_manager.get_active_workspace();
      const rect = (r) => [r.x, r.y, r.width, r.height];
      const monitors = global.backend
        .get_monitor_manager()
        .get_logical_monitors()
        .map((logical) => {
          const index = logical.get_number();
          const connector = logical.get_monitors()[0]?.get_connector() ?? `monitor-${index}`;
          return [
            connector,
            rect(display.get_monitor_geometry(index)),
            rect(workspace.get_work_area_for_monitor(index)),
            display.get_monitor_scale(index),
            rates.get(connector) ?? 0,
            display.get_primary_monitor() === index,
          ];
        });
      return [monitors];
    });
  }

  /** Taxa de atualização por conector, pela interface D-Bus pública do Mutter. */
  async _refreshRates() {
    try {
      const reply = await Gio.DBus.session.call(
        'org.gnome.Mutter.DisplayConfig',
        '/org/gnome/Mutter/DisplayConfig',
        'org.gnome.Mutter.DisplayConfig',
        'GetCurrentState',
        null,
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
      );
      return currentRefreshRates(reply.recursiveUnpack());
    } catch (error) {
      console.warn(`Kobi: refresh rates unavailable: ${error}`);
      return new Map();
    }
  }

  _reply(invocation, signature, work) {
    work()
      .then((values) => invocation.return_value(new GLib.Variant(signature, values)))
      .catch((error) => invocation.return_gerror(error));
  }

  /** Acompanha o ponteiro por evento do compositor (sem polling) enquanto o Kobi existir. */
  _listen(sender, window) {
    this._stopListening();
    this._listener = {
      sender,
      window,
      regions: [],
      // Desconhecido: a primeira conta sempre avisa o app, que começa capturando o mouse.
      inside: null,
      unmanagingId: window.connect('unmanaging', () => this._stopListening()),
    };
    this._cursorId = global.backend
      .get_cursor_tracker()
      .connect('position-invalidated', () => this._updatePointer());
  }

  _stopListening() {
    if (!this._listener) return;
    global.backend.get_cursor_tracker().disconnect(this._cursorId);
    this._listener.window.disconnect(this._listener.unmanagingId);
    this._listener = null;
  }

  /** Avisa o Kobi só quando o ponteiro entra ou sai da área dele, e só a ele. */
  _updatePointer() {
    const listener = this._listener;
    if (!listener) return;
    const inside = pointerInRegions(
      listener.window.get_frame_rect(),
      listener.regions,
      global.get_pointer(),
    );
    if (inside === listener.inside) return;
    listener.inside = inside;
    Gio.DBus.session.emit_signal(
      listener.sender,
      OBJECT_PATH,
      BUS_NAME,
      'PointerInside',
      new GLib.Variant('(b)', [inside]),
    );
  }

  /** No Wayland o app_id chega depois da criação da janela: acompanha até ele aparecer. */
  _watch(window) {
    if (this._claim(window)) return;
    const ids = [];
    const stop = () => {
      for (const id of ids.splice(0)) window.disconnect(id);
      this._watches.delete(stop);
    };
    ids.push(
      window.connect('notify::wm-class', () => {
        if (this._claim(window)) stop();
      }),
      window.connect('unmanaging', stop),
    );
    this._watches.add(stop);
  }

  /** Mantém a janela do Kobi acima das outras e em todas as áreas de trabalho. */
  _claim(window) {
    if (!isKobi(window)) return false;
    window.make_above();
    window.stick();
    return true;
  }

  /**
   * A janela do Kobi aberta pelo mesmo processo que chamou, já na tela: nunca age
   * sobre outras janelas.
   */
  async _callerWindow(invocation) {
    const pid = await this._pidOf(invocation.get_sender());
    return global
      .get_window_actors()
      .map((actor) => actor.get_meta_window())
      .find((window) => isKobi(window) && window.get_pid() === pid && isOnScreen(window));
  }

  async _pidOf(sender) {
    const cached = this._pids.get(sender);
    if (cached !== undefined) return cached;
    const reply = await Gio.DBus.session.call(
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus',
      'org.freedesktop.DBus',
      'GetConnectionUnixProcessID',
      new GLib.Variant('(s)', [sender]),
      new GLib.VariantType('(u)'),
      Gio.DBusCallFlags.NONE,
      -1,
      null,
    );
    const [pid] = reply.deepUnpack();
    this._pids.set(sender, pid);
    return pid;
  }
}
