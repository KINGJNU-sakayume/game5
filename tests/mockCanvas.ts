// 테스트용 가짜 캔버스 컨텍스트: 잘못된 인자(NaN, 음수 반지름)를 잡아냄
const CHECKED = new Set([
  'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'fillRect',
  'strokeRect', 'clearRect', 'translate', 'scale', 'rotate', 'fillText', 'strokeText', 'setTransform',
]);

export function mockCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: (o: number) => { if (!(o >= 0 && o <= 1)) throw new Error('bad color stop ' + o); } };
  const target: Record<string | symbol, unknown> = {
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    lineJoin: 'miter',
    measureText: (s: string) => ({ width: String(s).length * 8 }),
    createLinearGradient: (...a: number[]) => {
      if (a.some((v) => !Number.isFinite(v))) throw new Error('bad gradient');
      return grad;
    },
    createRadialGradient: (...a: number[]) => {
      if (a.some((v) => !Number.isFinite(v))) throw new Error('bad gradient');
      if (a[2] < 0 || a[5] < 0) throw new Error('negative radial radius');
      return grad;
    },
    createPattern: () => ({}),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    save: () => undefined,
    restore: () => undefined,
  };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      const name = String(p);
      return (...args: unknown[]) => {
        if (CHECKED.has(name)) {
          for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name}: non-finite arg ${args.join(',')}`);
          if ((name === 'arc' && (args[2] as number) < 0) || (name === 'ellipse' && ((args[2] as number) < 0 || (args[3] as number) < 0)) || (name === 'arcTo' && (args[4] as number) < 0)) {
            throw new Error(`${name}: negative radius ${args.join(',')}`);
          }
        }
        return undefined;
      };
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
