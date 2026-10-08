import dbus from '@homebridge/dbus-native';
import type { Point, RectProps } from '@kobi/domain';

/** O que a extensão GNOME do Kobi oferece (extensions/gnome, interface D-Bus). */
export interface OverlayExtension {
  /** Se a extensão está instalada, ativa e numa versão compatível. */
  available(): Promise<boolean>;
  /** false se a janela do Kobi ainda não existe para o compositor. */
  moveTo(topLeft: Point): Promise<boolean>;
  frame(): Promise<RectProps | undefined>;
  pointer(): Promise<Point>;
  setInteractiveRegion(regions: readonly RectProps[]): Promise<boolean>;
  /** Avisado quando o ponteiro entra ou sai da região interativa. */
  onPointerInside(listener: (inside: boolean) => void): void;
}

const BUS_NAME = 'io.github.wellingtonpaim.Kobi.Overlay';
const OBJECT_PATH = '/io/github/wellingtonpaim/Kobi/Overlay';
/** Versão da interface que este adaptador entende (propriedade Version da extensão). */
const SUPPORTED_VERSION = 1;

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
  private readonly listeners: ((inside: boolean) => void)[] = [];

  available(): Promise<boolean> {
    if (!process.env.DBUS_SESSION_BUS_ADDRESS) return Promise.resolve(false);
    return this.call('org.freedesktop.DBus.Properties', 'Get', 'ss', [BUS_NAME, 'Version'])
      .then(([variant]) => {
        const [, [version]] = variant as [unknown, [number]];
        return version === SUPPORTED_VERSION;
      })
      .catch(() => false);
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
    this.listeners.push(listener);
  }

  private call(
    iface: string,
    member: string,
    signature: string,
    body: readonly unknown[],
  ): Promise<unknown[]> {
    const bus = this.connect();
    return new Promise((resolve, reject) => {
      bus.invoke(
        { destination: BUS_NAME, path: OBJECT_PATH, interface: iface, member, signature, body },
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
    // O sinal vem endereçado só a esta conexão: não precisa de regra de correspondência.
    bus.connection.on('message', (message) => {
      if (message.type !== SIGNAL || message.member !== 'PointerInside') return;
      const inside = message.body?.[0] === true;
      for (const listener of this.listeners) listener(inside);
    });
    bus.connection.on('error', (error) => {
      console.error('[kobi] D-Bus', error);
    });
    this.bus = bus;
    return bus;
  }
}
