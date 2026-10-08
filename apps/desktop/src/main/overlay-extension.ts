import dbus from '@homebridge/dbus-native';
import type { Point, RectProps } from '@kobi/domain';

/** Um monitor como o GNOME o vê (pixels lógicos globais). */
export interface ExtensionMonitor {
  /** Nome do conector (eDP-1, HDMI-1...): estável e único enquanto o monitor existir. */
  readonly connector: string;
  readonly bounds: RectProps;
  /** Sem o painel superior e outras áreas reservadas pelo GNOME. */
  readonly workArea: RectProps;
  readonly scaleFactor: number;
  /** 0 quando o GNOME não informa. */
  readonly refreshRateHz: number;
  readonly primary: boolean;
}

/** Versões da interface da extensão: o que cada uma acrescentou. */
export const EXTENSION_VERSIONS = {
  /** Janela, ponteiro e região interativa. */
  overlay: 1,
  /** GetMonitors e MonitorsChanged. */
  monitors: 2,
} as const;

/** O que a extensão GNOME do Kobi oferece (extensions/gnome, interface D-Bus). */
export interface OverlayExtension {
  /** Versão da interface; 0 se a extensão não está instalada ou ativa. */
  version(): Promise<number>;
  /** false se a janela do Kobi ainda não existe para o compositor. */
  moveTo(topLeft: Point): Promise<boolean>;
  frame(): Promise<RectProps | undefined>;
  pointer(): Promise<Point>;
  setInteractiveRegion(regions: readonly RectProps[]): Promise<boolean>;
  /** Avisado quando o ponteiro entra ou sai da região interativa. */
  onPointerInside(listener: (inside: boolean) => void): void;
  /** A partir da versão 2. */
  monitors(): Promise<ExtensionMonitor[]>;
  /** Monitores, escala, disposição ou área útil mudaram (a partir da versão 2). */
  onMonitorsChanged(listener: () => void): void;
}

const BUS_NAME = 'io.github.wellingtonpaim.Kobi.Overlay';
const OBJECT_PATH = '/io/github/wellingtonpaim/Kobi/Overlay';
interface Message {
  readonly destination?: string;
  readonly path: string;
  readonly interface: string;
  readonly member: string;
  readonly signature?: string;
  readonly body?: readonly unknown[];
  readonly type?: number;
}

/** O pouco da @homebridge/dbus-native que usamos (os tipos dela não declaram o sessionBus). */
interface MessageBus {
  invoke(message: Message, callback: (error: unknown, ...values: unknown[]) => void): void;
  readonly connection: {
    on(event: 'message', listener: (message: Message) => void): void;
    on(event: 'error', listener: (error: unknown) => void): void;
  };
}

/** Tipo de mensagem D-Bus "sinal" (1 chamada, 2 retorno, 3 erro, 4 sinal). */
const SIGNAL = 4;

/** Cliente D-Bus da extensão, no barramento da sessão do usuário. */
export class DbusOverlayExtension implements OverlayExtension {
  private bus: MessageBus | undefined;
  private readonly pointerListeners: ((inside: boolean) => void)[] = [];
  private readonly monitorListeners: (() => void)[] = [];

  version(): Promise<number> {
    if (!process.env.DBUS_SESSION_BUS_ADDRESS) return Promise.resolve(0);
    return this.call('org.freedesktop.DBus.Properties', 'Get', 'ss', [BUS_NAME, 'Version'])
      .then(([variant]) => {
        const [, [version]] = variant as [unknown, [number]];
        return version;
      })
      .catch(() => 0);
  }

  async moveTo({ x, y }: Point): Promise<boolean> {
    const [moved] = await this.call(BUS_NAME, 'MoveTo', 'ii', [x, y]);
    return moved === true;
  }

  async frame(): Promise<RectProps | undefined> {
    const [found, frame] = (await this.call(BUS_NAME, 'GetFrame', '', [])) as [
      boolean,
      [number, number, number, number],
    ];
    if (!found) return undefined;
    const [x, y, width, height] = frame;
    return { x, y, width, height };
  }

  async pointer(): Promise<Point> {
    const [[x, y]] = (await this.call(BUS_NAME, 'GetPointer', '', [])) as [[number, number]];
    return { x, y };
  }

  async setInteractiveRegion(regions: readonly RectProps[]): Promise<boolean> {
    const rects = regions.map((r) => [r.x, r.y, r.width, r.height]);
    const [found] = await this.call(BUS_NAME, 'SetInteractiveRegion', 'a(iiii)', [rects]);
    return found === true;
  }

  onPointerInside(listener: (inside: boolean) => void): void {
    this.pointerListeners.push(listener);
  }

  async monitors(): Promise<ExtensionMonitor[]> {
    type Rect4 = [number, number, number, number];
    const [list] = (await this.call(BUS_NAME, 'GetMonitors', '', [])) as [
      [string, Rect4, Rect4, number, number, boolean][],
    ];
    const rect = ([x, y, width, height]: Rect4): RectProps => ({ x, y, width, height });
    return list.map(([connector, bounds, workArea, scaleFactor, refreshRateHz, primary]) => ({
      connector,
      bounds: rect(bounds),
      workArea: rect(workArea),
      scaleFactor,
      refreshRateHz,
      primary,
    }));
  }

  onMonitorsChanged(listener: () => void): void {
    // Sinal para todo o barramento: só chega com uma regra de correspondência.
    if (this.monitorListeners.length === 0) {
      const rule = `type='signal',sender='${BUS_NAME}',interface='${BUS_NAME}',member='MonitorsChanged'`;
      this.invoke(
        'org.freedesktop.DBus',
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        'AddMatch',
        's',
        [rule],
      ).catch((error: unknown) => {
        console.error('[kobi] D-Bus', error);
      });
    }
    this.monitorListeners.push(listener);
  }

  private call(
    iface: string,
    member: string,
    signature: string,
    body: readonly unknown[],
  ): Promise<unknown[]> {
    return this.invoke(BUS_NAME, OBJECT_PATH, iface, member, signature, body);
  }

  private invoke(
    destination: string,
    path: string,
    iface: string,
    member: string,
    signature: string,
    body: readonly unknown[],
  ): Promise<unknown[]> {
    const bus = this.connect();
    return new Promise((resolve, reject) => {
      bus.invoke(
        { destination, path, interface: iface, member, signature, body },
        (error, ...values) => {
          if (error) reject(new Error(`${member} failed: ${JSON.stringify(error)}`));
          else resolve(values);
        },
      );
    });
  }

  private connect(): MessageBus {
    if (this.bus) return this.bus;
    const bus = (dbus as unknown as { sessionBus(): MessageBus }).sessionBus();
    bus.connection.on('message', (message) => {
      if (message.type !== SIGNAL || message.interface !== BUS_NAME) return;
      // PointerInside vem endereçado só a esta conexão.
      if (message.member === 'PointerInside') {
        const inside = message.body?.[0] === true;
        for (const listener of this.pointerListeners) listener(inside);
      }
      if (message.member === 'MonitorsChanged')
        for (const listener of this.monitorListeners) listener();
    });
    bus.connection.on('error', (error) => {
      console.error('[kobi] D-Bus', error);
    });
    this.bus = bus;
    return bus;
  }
}
