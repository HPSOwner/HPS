import { BLUEPRINTS } from './blueprints.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

let currentKey = null;

function stepCountFor(parts) {
  const steps = parts.map((p) => p.step).filter((s) => s !== null);
  return steps.length ? Math.max(...steps) + 1 : 1;
}

export function renderBlueprint(svgEl, orderEl, titleEl, weaponKey) {
  const bp = BLUEPRINTS[weaponKey];
  if (!bp) return;
  currentKey = weaponKey;

  titleEl.textContent = `${bp.name} — Field Strip Schematic`;
  svgEl.setAttribute('viewBox', bp.viewBox);
  svgEl.innerHTML = '';

  for (const part of bp.parts) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('blueprint-part-group');
    g.dataset.step = part.step === null ? '' : String(part.step);
    g.dataset.dx = part.dx;
    g.dataset.dy = part.dy;
    g.innerHTML = part.shape;

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'blueprint-label');
    label.setAttribute('x', part.labelPos.x);
    label.setAttribute('y', part.labelPos.y);
    label.textContent = part.label;
    g.appendChild(label);

    svgEl.appendChild(g);
  }

  orderEl.innerHTML = bp.order
    .map((name, i) => `<span class="step" data-order-step="${i}">${i + 1}. ${name}</span>`)
    .join('  &rarr;  ');
}

export function updateBlueprint(svgEl, orderEl, weaponKey, takedownAmount) {
  if (weaponKey !== currentKey) return;
  const bp = BLUEPRINTS[weaponKey];
  if (!bp) return;
  const stepCount = stepCountFor(bp.parts);

  const groups = svgEl.querySelectorAll('.blueprint-part-group');
  groups.forEach((g) => {
    const step = g.dataset.step;
    if (step === '') return; // never moves
    const s = Number(step);
    const localT = Math.min(Math.max((takedownAmount - s / stepCount) * stepCount, 0), 1);
    const dx = Number(g.dataset.dx) * localT;
    const dy = Number(g.dataset.dy) * localT;
    g.setAttribute('transform', `translate(${dx}, ${dy})`);
  });

  const activeSteps = Math.floor(takedownAmount * stepCount + 0.001);
  orderEl.querySelectorAll('[data-order-step]').forEach((el) => {
    const i = Number(el.dataset.orderStep);
    el.classList.toggle('done', i < activeSteps);
  });
}
