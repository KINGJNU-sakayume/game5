// 메뉴 배경음악 (끊김 없는 루프)
import { ChartBuilder } from './core/chart';
import { audio, renderSong } from './core/audio';

export const COMMON_SFX: [string, number][] = [
  ['uiSelect', 0],
  ['uiConfirm', 0],
  ['uiBack', 0],
  ['tick', 0],
  ['stamp', 0],
  ['fanfare', 0],
  ['okJingle', 0],
  ['sadJingle', 0],
  ['count', 0],
  ['countHi', 0],
  ['block', 0],
  ['cheer', 0],
  ['whoosh', 0],
];

const MENU_BPM = 112;

function menuTheme(b: ChartBuilder) {
  const prog = 'C Am F G C Am F G';
  b.chords(0, 4, prog, 'pad', { center: 62, vel: 0.55 });
  b.bassline(0, 4, prog, 'R..R.5..', 'bassSoft', { vel: 0.7 });
  for (let i = 0; i < 8; i++) {
    b.drums(b.bar(i), 0.5, { k: 'x...x...', r: '..x...x.', sh: 'xoxoxoxo' }, { vel: 0.8 });
  }
  const mel = [
    'E5 . G5 . C6 . G5 .', 'A5 . E5 . C5 . E5 .', 'F5 . A5 . C6 . A5 .', 'G5 - - . D5 . G5 .',
    'E5 . G5 . C6 . D6 .', 'E6 . C6 . A5 . C6 .', 'D6 . C6 . A5 . F5 .', 'G5 - - - D5 . B4 .',
  ].join(' ');
  b.seq(0, 0.5, mel, 'marimba', { vel: 0.75, transpose: -12 });
  b.seq(0, 0.5, mel, 'bell', { vel: 0.25 });
  b.arp(0, 4, prog, 'chip', { step: 0.25, center: 76, vel: 0.18, order: [0, 1, 2, 1] });
}

let buffer: AudioBuffer | null = null;
let src: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let loading: Promise<void> | null = null;

export const bgm = {
  ensure(): Promise<void> {
    if (buffer || !audio.ctx || !audio.bank) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      const b = new ChartBuilder(MENU_BPM);
      menuTheme(b);
      const chart = b.build(0);
      const loopSec = b.bar(8) * b.spb;
      const r = await renderSong(chart.notes, audio.bank!, loopSec + 3);
      const n = Math.round(loopSec * r.sr);
      // 루프 끝을 넘어간 여운을 앞부분에 겹쳐서 이음새 제거
      for (let i = n; i < r.length; i++) {
        r.L[i - n] += r.L[i];
        r.R[i - n] += r.R[i];
      }
      buffer = audio.toBuffer({ L: r.L.subarray(0, n), R: r.R.subarray(0, n), length: n, sr: r.sr });
    })();
    return loading;
  },
  play() {
    if (!buffer || src || !audio.ctx) return;
    gainNode = audio.ctx.createGain();
    gainNode.connect(audio.musicBus);
    const now = audio.ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.85, now + 0.6);
    src = audio.playBuffer(buffer, now + 0.03, gainNode, true);
  },
  stop(fade = 0.3) {
    if (!src || !audio.ctx || !gainNode) return;
    const now = audio.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + fade);
    try {
      src.stop(now + fade + 0.05);
    } catch {
      /* ignore */
    }
    src = null;
    gainNode = null;
  },
  get playing() {
    return !!src;
  },
};
