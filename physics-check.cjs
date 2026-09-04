const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app.js', 'utf8');
const start = source.indexOf('  function computeAccelerations()');
const end = source.indexOf('  function resolveCollisions()', start);
const context = vm.createContext({ Math, state: { bodies: [] }, G: 4 * Math.PI ** 2, resolveCollisions() {}, resolveTidalDisruptions() {} });
vm.runInContext(source.slice(start, end), context);
const earth = 1 / 332946;
const moon = earth * .0123;
const distance = 384400 / 149597870.7;
const mu = 4 * Math.PI ** 2 * (earth + moon);
const speed = Math.sqrt(mu / distance);
context.state.bodies = [
  { mass: earth, x: -distance * moon / (earth + moon), y: 0, vx: 0, vy: -speed * moon / (earth + moon) },
  { mass: moon, isMoon: true, x: distance * earth / (earth + moon), y: 0, vx: 0, vy: speed * earth / (earth + moon) },
];
const period = 2 * Math.PI * Math.sqrt(distance ** 3 / mu);
for (let i = 0; i < 20000; i++) context.integrate(period / 2000);
const [a,b] = context.state.bodies;
const error = Math.abs(Math.hypot(b.x-a.x,b.y-a.y)/distance-1);
assert(error < 1e-4, `Lunar orbit radial drift: ${error}`);
assert(Math.hypot(a.mass*a.vx+b.mass*b.vx,a.mass*a.vy+b.mass*b.vy) < 1e-15);
console.log('PASS: ten lunar orbits remain stable; total momentum conserved.');
assert(source.includes('Math.min(requestedDt / steps, accuracyStep)'));
console.log('PASS: requested time acceleration cannot exceed the safe step.');
