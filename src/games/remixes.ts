// 리믹스 1, 2 정의 (곡 + 구성)
import type { ChartBuilder } from '../core/chart';
import { badminton } from './badminton';
import { balloon } from './balloon';
import { chef } from './chef';
import { frogs } from './frogs';
import { ninja } from './ninja';
import { penguin } from './penguin';
import { makeRemix, type RemixPlanItem } from './remix';
import { trio } from './trio';
import { waltzGame } from './waltz';

function plan(order: string[], barsList: number[][]): RemixPlanItem[] {
  const out: RemixPlanItem[] = [];
  barsList.forEach((row, v) => row.forEach((bars, i) => out.push({ game: order[i], bars, variant: v })));
  return out;
}

function popBody(
  b: ChartBuilder,
  intro: number,
  body: number,
  progs: string[],
  mels: string[],
  opt: { kickPat: string; bassPat: string; stab: string; lead: string },
) {
  // 인트로
  for (let i = 0; i < intro; i++) b.drums(b.bar(i), 0.5, { k: 'x...x...', h: 'x.x.x.x.', s: i === intro - 1 ? '....x.XX' : '' });
  b.countIn(b.bar(intro - 1), 4);
  b.chords(0, intro * 4, progs[0].split(' ')[0], 'pad', { center: 64, vel: 0.5 });
  // 본문: 8마디 단위 반복
  for (let bar = intro; bar < intro + body; bar += 8) {
    const n = Math.min(8, intro + body - bar);
    const loop = Math.floor((bar - intro) / 8);
    const prog = progs[loop % progs.length].split(' ').slice(0, n).join(' ');
    const mel = mels[loop % mels.length].split(' ').slice(0, n * 8).join(' ');
    b.note(b.bar(bar), 'crash', 0, 1, 0.7);
    for (let i = 0; i < n; i++) {
      b.drums(b.bar(bar + i), 0.5, { k: opt.kickPat, c: '..x...x.', h: 'xoxoxoxo' }, { vel: 0.75 });
    }
    b.bassline(b.bar(bar), 4, prog, opt.bassPat, 'bass', { vel: 0.75 });
    b.chords(b.bar(bar), 4, prog, 'pad', { center: 62, vel: 0.45 });
    if (loop % 2 === 0) {
      b.seq(b.bar(bar), 0.5, mel, opt.lead, { vel: 0.55 });
      b.chords(b.bar(bar), 4, prog, opt.stab, { rhythm: '.x.x.x.x', center: 66, vel: 0.35 });
    } else {
      b.arp(b.bar(bar), 4, prog, 'chip', { step: 0.25, center: 76, vel: 0.22, order: [0, 1, 2, 1] });
      b.seq(b.bar(bar), 0.5, mel, 'bell', { vel: 0.3 });
    }
  }
  // 아웃트로
  const end = intro + body;
  b.note(b.bar(end), 'crash', 0, 1, 1);
  b.note(b.bar(end), 'kick', 0, 1, 1);
  const last = progs[0].split(' ')[0];
  b.chords(b.bar(end), 4, last, 'brass', { center: 66, vel: 0.8, gate: 0.7 });
  b.chords(b.bar(end), 4, last, 'pad', { center: 60, vel: 0.7 });
  b.bassline(b.bar(end), 4, last, 'R-------', 'bass');
  b.sfx(b.bar(end), 'cheer', 0.6);
}

export const remix1 = makeRemix({
  id: 'remix1',
  title: '리믹스 1',
  sub: 'Starland Remix 1',
  desc: '세트 1의 게임들이 한 곡 안에서 번갈아 나와요!',
  howto: '셰프, 참새, 풍선, 닌자가 새 노래에 맞춰 차례로 등장해요.\n화면이 바뀌어도 규칙은 그대로! 소리를 잘 들어요.',
  color: '#ff9ad5',
  accent: '#fff0f8',
  bpm: 120,
  games: [chef, trio, balloon, ninja],
  plan: plan(['chef', 'trio', 'balloon', 'ninja'], [
    [4, 4, 4, 4],
    [4, 4, 4, 4],
    [2, 2, 2, 2],
  ]),
  music(b, intro, body) {
    const progs = ['E C#m A B E C#m A B', 'A B G#m C#m F#m B E E'];
    const mels = [
      [
        'B4 . E5 . G#5 . B5 .', 'C#6 - B5 . G#5 . E5 .', 'A5 . C#6 . E6 . C#6 .', 'B5 - - . F#5 . A5 .',
        'G#5 . B5 . E6 . D#6 .', 'E6 - C#6 . B5 . G#5 .', 'A5 . G#5 . F#5 . A5 .', 'B5 - - - . . . .',
      ].join(' '),
      [
        'C#6 . B5 . A5 . E5 .', 'F#5 - - . D#5 . F#5 .', 'G#5 . B5 . E6 . B5 .', 'C#6 - - . G#5 . E5 .',
        'A5 . C#6 . F#6 . C#6 .', 'D#6 - B5 . F#5 . A5 .', 'G#5 - - . B5 . E6 .', 'E6 - - - . . . .',
      ].join(' '),
    ];
    popBody(b, intro, body, progs, mels, { kickPat: 'x...x...', bassPat: 'R.R8R.R8', stab: 'ep', lead: 'lead' });
  },
  epilogue: {
    hi: '별나라 퍼레이드의 주인공이 되었어요!',
    ok: '퍼레이드는 무사히 끝났어요. 박수 짝짝!',
    try: '퍼레이드 행렬이 뒤죽박죽이 되었어요...',
  },
});

export const remix2 = makeRemix({
  id: 'remix2',
  title: '리믹스 2',
  sub: 'Starland Remix 2',
  desc: '세트 2의 게임들이 한 곡 안에서 번갈아 나와요!',
  howto: '펭귄, 달토끼, 개구리, 요정이 새 노래에 맞춰 차례로 등장해요.\n요정은 이 곡에서 두 박마다 앞을 지나요!',
  color: '#8fd0ff',
  accent: '#eef8ff',
  bpm: 118,
  games: [penguin, badminton, frogs, waltzGame],
  plan: plan(['penguin', 'badminton', 'frogs', 'waltz'], [
    [4, 4, 4, 4],
    [4, 4, 4, 4],
    [2, 2, 2, 2],
  ]),
  music(b, intro, body) {
    const progs = ['G A F#m Bm G A D D', 'Em A D Bm G A Bm A'];
    const mels = [
      [
        'D5 . G5 . B5 . D6 .', 'C#6 - A5 . E5 . A5 .', 'F#5 . A5 . C#6 . A5 .', 'B5 - - . F#5 . D5 .',
        'G5 . B5 . D6 . E6 .', 'F#6 - E6 . C#6 . A5 .', 'D6 . A5 . F#5 . A5 .', 'D6 - - - . . . .',
      ].join(' '),
      [
        'E5 . G5 . B5 . G5 .', 'A5 - C#6 . E6 . C#6 .', 'D6 . F#6 . A5 . F#5 .', 'B5 - - . D6 . F#6 .',
        'G5 . B5 . D6 . B5 .', 'A5 - C#6 . E6 . A5 .', 'B5 . D6 . F#6 . D6 .', 'C#6 - - - . . . .',
      ].join(' '),
    ];
    popBody(b, intro, body, progs, mels, { kickPat: 'x..x..x.', bassPat: 'R.5.R.58', stab: 'brass', lead: 'flute' });
  },
  epilogue: {
    hi: '남극부터 달나라까지, 모두가 함께 춤췄어요!',
    ok: '신나는 무대였어요. 다음엔 더 완벽하게!',
    try: '무대 위가 대혼란... 다들 어리둥절해요.',
  },
});
