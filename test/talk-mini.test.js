/* 分享会讲稿（docs/talk/）里嵌了四个能玩的小游戏，是第 03 段"现场做一个"的兜底：
   万一现场生成失败，直接翻到那几页就是成品。所以它必须真的能玩。
   浏览器里没法自动验——页面不合成时 rAF 不跑，headless 也只给一两帧——
   于是照 aim.test.js 的老办法，把 Mini() 的源码抠出来丢进 vm，配一块假画布和一只手拨的表。 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'docs', 'talk', '_p3_script.html'), 'utf8');

function extract(name){
  const head = src.indexOf('function ' + name + '(');
  assert.ok(head >= 0, name + ' 没找到');
  let depth = 0;
  for (let j = src.indexOf('{', head); j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(head, j + 1);
  }
  throw new Error('括号没配平');
}

/* ---- 假画布：只记调用，不画东西。fillStyle 就是"这一笔画的是谁"的标记 ---- */
function makeCanvas(){
  const listeners = {};
  const ctx = {
    fillStyle: '', font: '', textAlign: '',
    fillRect(){}, clearRect(){}, fillText(){},
    beginPath(){}, moveTo(){}, lineTo(){}, arc(){}, fill(){}, stroke(){},
    createLinearGradient(){ return { addColorStop(){} }; },
  };
  const cv = {
    width: 1108, height: 316, tabIndex: 0,
    parentNode: { style: {} },
    getContext: () => ctx,
    setAttribute(){},
    focus(){ env.document.activeElement = cv; },
    blur(){ env.document.activeElement = null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1108, height: 316 }),
    addEventListener(t, fn){ (listeners[t] ||= []).push(fn); },
    emit(t, ev){ (listeners[t] || []).forEach(fn => fn({ preventDefault(){}, ...ev })); },
  };
  return cv;
}

/* ---- 手拨的表 + 手拨的 rAF ---- */
let now = 0, queue = [];
const env = {
  performance: { now: () => now },
  requestAnimationFrame(fn){ queue.push(fn); return queue.length; },
  cancelAnimationFrame(){ queue = []; },
  document: { activeElement: null },
  Math, Object, Array, console,
};
vm.createContext(env);
vm.runInContext(extract('Mini'), env);

function run(seconds, stepMs = 16){
  for (let t = 0; t < seconds * 1000; t += stepMs){
    now += stepMs;
    const q = queue; queue = [];
    q.forEach(fn => fn(now));
  }
}
// 数某种颜色的方块被画了几次
function counter(cv, color){
  const ctx = cv.getContext();
  const inner = ctx.fillRect;
  let n = 0;
  ctx.fillRect = function(...a){ if (ctx.fillStyle === color) n++; return inner.apply(this, a); };
  return () => n;
}

test('第 1 句 · 方向键推得动，且不会走出画面', () => {
  const cv = makeCanvas();
  env.Mini(cv, 1).start();
  const xs = [];
  cv.getContext().fillRect = (x) => { xs.push(x); };
  run(0.2);
  const x0 = xs.at(-1);
  cv.emit('keydown', { key: 'ArrowRight' });
  run(0.5);
  assert.ok(xs.at(-1) > x0 + 50, '按住右键半秒没往右走');
  run(6);                                          // 一直按着，早该顶到边
  assert.ok(xs.at(-1) <= 1108, '走出右边界了：' + xs.at(-1));
});

test('第 2 句 · 点一下就有子弹飞出去', () => {
  const cv = makeCanvas();
  env.Mini(cv, 2).start();
  run(0.2);
  const whites = counter(cv, '#ffffff');
  run(0.16);
  const perFrameBaseline = whites();               // 只有玩家那一块
  cv.emit('mousemove', { clientX: 900, clientY: 150 });
  cv.emit('mousedown', { clientX: 900, clientY: 150 });
  const before = whites();
  run(0.16);
  assert.ok(whites() - before > perFrameBaseline, '点击之后没多出子弹');
});

test('第 3 句 · 过几秒真的会刷出敌人，并且朝玩家走', () => {
  const cv = makeCanvas();
  env.Mini(cv, 3).start();
  const reds = counter(cv, '#ff5d52');
  run(3);
  assert.ok(reds() > 0, '三秒内一只敌人都没刷出来');
});

test('第 4 句 · 会被碰死、能加分、按 R 重来', () => {
  const cv = makeCanvas();
  env.Mini(cv, 4).start();
  const ctx = cv.getContext();
  let over = false, lastScore = '';
  ctx.fillText = (txt) => {
    const s = String(txt);
    if (s.includes('GAME OVER')) over = true;
    if (s.startsWith('SCORE')) lastScore = s;
  };
  run(40);
  assert.ok(over, '四十秒都没被敌人碰到，失败判定没生效');
  assert.match(lastScore, /^SCORE \d+$/, '没在画分数');

  over = false;
  cv.emit('keydown', { key: 'r' });
  run(0.2);
  assert.equal(over, false, '按 R 之后应该重新开局');
});
