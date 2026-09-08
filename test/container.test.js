/* 容器状态（Toy JS SDK）的单测。
   和 aim.test.js 一个路子：script.js 挂在 DOM 上没法 import，就把这几个函数的源码
   原样抠出来丢进 vm 跑——测的是仓库里那一份真代码。依赖的全局在 ctx 里注入，
   定时器换成手动触发的假货，免得为了等一次超时就把测试拖上 1.5 秒。

   这套 API 的坑全在「不确定」上，所以用例盯的也是这几条：
     · 站外 / 老版本 App / 鸿蒙：能力不在，要静悄悄降级，不能抛也不能挂着不给结论
     · 切没切成以容器回调里的实际状态为准，不看 setContainerMode 有没有 resolve
     · 每一发请求都必须有结论，否则转屏按钮会被永久钉在 disabled 上 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'script.js'), 'utf8');

function extract(name){
  const start = src.indexOf('function ' + name);
  assert.ok(start > 0, '没找到 ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(name + ' 的花括号没配平');
}

const NL = String.fromCharCode(10);
const timers = new Map();
let nextTimer = 1;
let cssVars = {};
let viewportRelayouts = 0;

const ctx = {
  SA_SIDES: ['top', 'right', 'bottom', 'left'],
  container: null,
  containerWaiters: [],
  state: 'menu',
  sdk: null,
  toySdk(){ return ctx.sdk; },
  onViewportChange(){ viewportRelayouts++; },
  refreshScreenBtns(){},
  document: { documentElement: { style: { setProperty(k, v){ cssVars[k] = v; } } } },
  setTimeout(fn){ const id = nextTimer++; timers.set(id, fn); return id; },
  clearTimeout(id){ timers.delete(id); },
};
vm.createContext(ctx);
vm.runInContext([
  extract('applyContainerSafeArea'), extract('applyContainerState'),
  extract('containerMatches'), extract('watchContainerMode'),
  extract('requestContainerMode'), extract('syncContainerImmersive'),
  extract('containerCanRotate'), extract('screenModeReq'),
  'globalThis.__request = requestContainerMode;',
  'globalThis.__apply = applyContainerState;',
  'globalThis.__sync = syncContainerImmersive;',
  'globalThis.__canRotate = containerCanRotate;',
  'globalThis.__modeReq = screenModeReq;',
].join(NL), ctx);

const request = ctx.__request, apply = ctx.__apply, sync = ctx.__sync;

// 定时器是手动的：不 fire 就等于「容器一直没回话」，正好用来演等待和超时
function fireTimers(){
  const pending = [...timers.values()];
  timers.clear();
  for (const fn of pending) fn();
}
// 让 vm 里那串 then 跑完。await 一次只推进一层，所以多推几轮
async function settle(rounds = 6){
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

function fakeSdk(over){
  const calls = { set: [], get: 0 };
  const sdk = {
    calls,
    setContainerMode(req){ calls.set.push(req); return Promise.resolve(); },
    getContainerState(){ calls.get++; return Promise.resolve(snapshot()); },
  };
  return Object.assign(sdk, over);
}
function snapshot(){
  const c = ctx.container;
  return { deviceType:c.deviceType, orientation:c.orientation,
           immersive:c.immersive, safeArea:{ top:0, right:0, bottom:0, left:0 } };
}

test.beforeEach(() => {
  timers.clear(); nextTimer = 1; cssVars = {}; viewportRelayouts = 0;
  ctx.containerWaiters = [];
  ctx.state = 'menu';
  ctx.container = { ok:true, deviceType:'phone', orientation:'portrait',
                    immersive:false, safeArea:{ top:0, right:0, bottom:0, left:0 },
                    pending:'', unsub:null };
  ctx.sdk = fakeSdk();
});

test('能力不在就当没有这条路：不碰 SDK，直接给个 false', async () => {
  ctx.container.ok = false;
  assert.equal(await request({ orientation:'landscape' }), false);
  assert.equal(ctx.sdk.calls.set.length, 0);
});

test('已经是目标状态就别再下发——每次界面切换都打一发是纯浪费', async () => {
  assert.equal(await request({ immersive:false }), true);
  assert.equal(ctx.sdk.calls.set.length, 0);
});

test('判据是容器回调里的实际状态，不是 setContainerMode 有没有 resolve', async () => {
  const p = request({ orientation:'landscape' });   // SDK 这一发会 resolve，但容器纹丝不动
  await settle();
  assert.deepEqual(ctx.sdk.calls.set, [{ orientation:'landscape' }]);
  fireTimers();                                     // 等够了：主动读一次容器再下结论
  await settle();
  assert.equal(await p, false, 'resolve 了不等于切成了');
  assert.equal(ctx.sdk.calls.get, 1);
  assert.equal(ctx.container.pending, '', '结论出了就得把在途标记清掉，否则下次同样的请求会被自己挡回去');
});

test('容器回调把新状态送回来 = 切成了，顺带重排一次版', async () => {
  const p = request({ orientation:'landscape' });
  await settle();
  apply({ orientation:'landscape', immersive:false, deviceType:'phone',
          safeArea:{ top:47, right:0, bottom:34, left:0 } });
  assert.equal(await p, true);
  assert.equal(ctx.container.orientation, 'landscape');
  assert.equal(cssVars['--sa-top'], '47px');
  assert.equal(cssVars['--sa-bottom'], '34px');
  assert.ok(viewportRelayouts > 0, '安全区和横竖屏变了就得重排');
});

test('SDK 当场抛（站外浏览器就是这样）不该炸出去，也不用等满超时', async () => {
  ctx.sdk.setContainerMode = () => Promise.reject(new Error('unsupported'));
  const p = request({ orientation:'landscape' });
  await settle();
  assert.equal(await p, false, '没等 fireTimers 就该有结论了');
});

test('同一个请求连点两次，第二次直接回 false，不重复下发', async () => {
  const first = request({ orientation:'landscape' });
  const second = request({ orientation:'landscape' });
  await settle();
  assert.equal(await second, false);
  assert.equal(ctx.sdk.calls.set.length, 1);
  fireTimers(); await settle();
  await first;                                       // 收尾，别留个吊着的 promise
});

test('容器读状态也失败时仍然给结论——不给结论按钮就永远卡在 disabled', async () => {
  ctx.sdk.getContainerState = () => Promise.reject(new Error('boom'));
  const p = request({ orientation:'landscape' });
  await settle();
  fireTimers();
  await settle();
  assert.equal(await p, false);
});

test('安全区脏数据一律夹到 0：负数、NaN、缺字段都不能变成 CSS 里的鬼值', () => {
  apply({ safeArea:{ top:-20, right:'x', bottom:12.4, left:null } });
  assert.equal(cssVars['--sa-top'], '0px');
  assert.equal(cssVars['--sa-right'], '0px');
  assert.equal(cssVars['--sa-bottom'], '12px');
  assert.equal(cssVars['--sa-left'], '0px');
});

test('开打进沉浸、停下就还回去', async () => {
  ctx.state = 'play';
  sync();
  await settle();
  assert.deepEqual(ctx.sdk.calls.set, [{ immersive:true }]);

  apply({ immersive:true });
  ctx.state = 'pause';                 // 暂停就把 B 站那圈界面还给玩家——那是退路
  sync();
  await settle();
  assert.deepEqual(ctx.sdk.calls.set[1], { immersive:false });
});

test('横屏时暂停不退沉浸——App 那圈界面是竖版的，横过来还回去就是纯占地方', async () => {
  apply({ orientation:'landscape', immersive:true });
  ctx.state = 'pause';
  sync();
  await settle();
  assert.deepEqual(ctx.sdk.calls.set, [], '已经是想要的状态，一发都不该下发');
});

test('切横屏时方向和沉浸一次传齐，别让页面闪两下', async () => {
  assert.deepEqual(ctx.__modeReq('landscape'), { orientation:'landscape', immersive:true });
  assert.deepEqual(ctx.__modeReq('portrait'),  { orientation:'portrait',  immersive:false });
});

test('拿不到容器能力时不显示转屏按钮；桌面端也不显示', () => {
  assert.equal(ctx.__canRotate(), true);
  ctx.container.deviceType = 'desktop';
  assert.equal(ctx.__canRotate(), false, '桌面端没有「转屏」这回事');
  ctx.container.deviceType = 'phone';
  ctx.container.ok = false;
  assert.equal(ctx.__canRotate(), false);
});
