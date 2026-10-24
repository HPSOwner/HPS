import * as THREE from 'three';

function canvasTexture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeFloorTexture() {
  const tex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#2a2d31';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    const cell = s / 8;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell); ctx.stroke();
    }
    // grime speckle
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // faded hazard stripe band
    ctx.save();
    ctx.translate(s * 0.1, s * 0.85);
    ctx.rotate(-0.05);
    ctx.fillStyle = 'rgba(180,140,20,0.18)';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(i * 40, 0, 20, s * 0.08);
    }
    ctx.restore();
  }, 1024);
  tex.repeat.set(6, 6);
  return tex;
}

export function makeCrateTexture() {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = '#5a4428';
    ctx.fillRect(0, 0, s, s);
    // wood grain
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(30,18,8,${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const y = (i / 40) * s + Math.random() * 6;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + Math.random() * 10 - 5, s * 0.7, y + Math.random() * 10 - 5, s, y);
      ctx.stroke();
    }
    // plank seams
    ctx.strokeStyle = 'rgba(20,12,5,0.6)';
    ctx.lineWidth = 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((i / 4) * s, 0); ctx.lineTo((i / 4) * s, s); ctx.stroke();
    }
    // metal corner bracket hint
    ctx.fillStyle = 'rgba(60,65,70,0.5)';
    ctx.fillRect(0, 0, s * 0.08, s * 0.08);
    ctx.fillRect(s * 0.92, 0, s * 0.08, s * 0.08);
    ctx.fillRect(0, s * 0.92, s * 0.08, s * 0.08);
    ctx.fillRect(s * 0.92, s * 0.92, s * 0.08, s * 0.08);
    // stencil
    ctx.fillStyle = 'rgba(200,40,30,0.75)';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIREARMS', s / 2, s * 0.5);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(220,220,210,0.7)';
    ctx.fillText('CAL 9x19 — HANDLE WITH CARE', s / 2, s * 0.58);
    ctx.strokeStyle = 'rgba(200,40,30,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(s * 0.1, s * 0.38, s * 0.8, s * 0.3);
  }, 512);
}

export function makeMetalTexture(tint = '#3a3f44') {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const v = Math.random() * 0.12;
      ctx.fillStyle = `rgba(255,255,255,${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      const y = Math.random() * s;
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + (Math.random() * 4 - 2));
      ctx.stroke();
    }
  }, 256);
}

export function makeFoamTexture() {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, s, s);
    const cell = s / 10;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
        ctx.fillRect(x * cell, y * cell, cell - 2, cell - 2);
      }
    }
  }, 256);
}
