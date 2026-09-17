const sky = {
  canvas: document.getElementById("sky"),
  ctx: null,
  night: NIGHTS[0],
  t: 0,
  meteor: null,
  dpr: 1,
  cache: null,
  cacheKey: "",
};

function viewportSize() {
  const view = window.visualViewport;
  return {
    w: Math.round(view ? view.width : window.innerWidth),
    h: Math.round(view ? view.height : window.innerHeight),
  };
}

function initSky() {
  sky.ctx = sky.canvas.getContext("2d", { alpha: false });
  resizeSky();
  window.addEventListener("resize", resizeSky);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(resizeSky, 250);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeSky);
  }
}

function resizeSky() {
  sky.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = viewportSize();
  sky.canvas.width = Math.max(1, Math.floor(w * sky.dpr));
  sky.canvas.height = Math.max(1, Math.floor(h * sky.dpr));
  sky.canvas.style.width = `${w}px`;
  sky.canvas.style.height = `${h}px`;
  sky.cacheKey = "";
}

function project(alt, az, w, h) {
  const rMax = Math.hypot(w, h) * 0.52;
  const r = ((90 - alt) / 90) * rMax;
  const a = az * DEG;
  return {
    x: w / 2 + r * Math.sin(a),
    y: h / 2 - r * Math.cos(a),
  };
}

function setNightSky(night) {
  sky.night = night;
  sky.cacheKey = "";
}

function projectNight() {
  const night = sky.night;
  const w = sky.canvas.width;
  const h = sky.canvas.height;
  const key = `${night.id}:${w}x${h}`;
  if (sky.cacheKey === key && sky.cache) return sky.cache;

  const date = new Date(night.utc);
  const jd = julianDate(date);
  const lst = lstHours(gstHours(jd), night.lon);
  const moon = moonPosition(jd);
  const moonHz = raDecToAltAz(moon.raHours, moon.decDeg, night.lat, lst);

  const stars = [];
  for (let i = 0; i < STAR_CATALOG.length; i += 1) {
    const [ra, dec, mag] = STAR_CATALOG[i];
    const hz = raDecToAltAz(ra, dec, night.lat, lst);
    if (hz.alt < 0.6) continue;
    const xy = project(hz.alt, hz.az, w, h);
    stars.push({
      i,
      mag,
      x: xy.x,
      y: xy.y,
      extinction: Math.max(0.15, Math.sin(hz.alt * DEG)),
    });
  }

  const milky = [];
  for (const p of MILKY_WAY) {
    const hz = raDecToAltAz(p.raHours, p.decDeg, night.lat, lst);
    if (hz.alt < 2) continue;
    const xy = project(hz.alt, hz.az, w, h);
    milky.push({
      x: xy.x,
      y: xy.y,
      a: night.milky * (0.035 + (hz.alt / 90) * 0.05),
    });
  }

  const lines = ASTERISMS.map((group) =>
    group.map(([ra, dec]) => {
      const hz = raDecToAltAz(ra, dec, night.lat, lst);
      if (hz.alt < 1) return null;
      return project(hz.alt, hz.az, w, h);
    })
  );

  sky.cache = {
    stars,
    milky,
    lines,
    moon: moonHz.alt > 0 ? { ...project(moonHz.alt, moonHz.az, w, h), phase: moon.phase } : null,
  };
  sky.cacheKey = key;
  return sky.cache;
}

function maybeMeteor() {
  if (sky.meteor || Math.random() > 0.004) return;
  const w = sky.canvas.width;
  const h = sky.canvas.height;
  sky.meteor = {
    x: w * (0.15 + Math.random() * 0.7),
    y: h * (0.08 + Math.random() * 0.25),
    vx: (Math.random() * 2 - 0.3) * 14 * sky.dpr,
    vy: (8 + Math.random() * 10) * sky.dpr,
    life: 1,
  };
}

function drawSky(now) {
  const ctx = sky.ctx;
  const w = sky.canvas.width;
  const h = sky.canvas.height;
  const night = sky.night;
  sky.t = now * 0.001;
  const cache = projectNight();

  const zenith = ctx.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  zenith.addColorStop(0, "#1b1030");
  zenith.addColorStop(0.45, "#12091d");
  zenith.addColorStop(1, "#07040c");
  ctx.fillStyle = zenith;
  ctx.fillRect(0, 0, w, h);

  const horizon = ctx.createRadialGradient(w / 2, h * 0.92, 10, w / 2, h * 0.78, h * 0.62);
  horizon.addColorStop(0, `rgba(186, 92, 84, ${0.16 + night.glow * 0.22})`);
  horizon.addColorStop(0.45, `rgba(92, 42, 78, ${0.08 + night.glow * 0.12})`);
  horizon.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of cache.milky) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 90 * sky.dpr);
    g.addColorStop(0, `rgba(232, 196, 210, ${p.a})`);
    g.addColorStop(1, "rgba(232, 196, 210, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 90 * sky.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(232, 180, 184, 0.18)";
  ctx.lineWidth = 1 * sky.dpr;
  for (const group of cache.lines) {
    ctx.beginPath();
    let started = false;
    for (const p of group) {
      if (!p) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  for (const star of cache.stars) {
    const twinkle = 0.82 + 0.18 * Math.sin(sky.t * (1.3 + (star.i % 7) * 0.17) + star.i);
    const vis =
      Math.max(0, (6.6 - star.mag) / 8) *
      star.extinction *
      twinkle *
      (0.55 + (1 - night.glow) * 0.5);
    if (vis < 0.03) continue;
    const size = (2.1 - star.mag * 0.28) * sky.dpr * (0.7 + vis);
    const warm = star.mag < 1.2 ? "255, 214, 196" : star.mag < 2.4 ? "246, 232, 224" : "232, 220, 255";
    ctx.beginPath();
    ctx.fillStyle = `rgba(${warm}, ${Math.min(1, vis)})`;
    ctx.arc(star.x, star.y, Math.max(0.45, size), 0, Math.PI * 2);
    ctx.fill();
    if (star.mag < 1.6) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${warm}, ${vis * 0.22})`;
      ctx.arc(star.x, star.y, Math.max(0.45, size) * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (cache.moon) {
    const { x, y, phase } = cache.moon;
    const r = 11 * sky.dpr;
    const glow = ctx.createRadialGradient(x, y, r, x, y, r * 6);
    glow.addColorStop(0, "rgba(255, 236, 210, 0.35)");
    glow.addColorStop(1, "rgba(255, 236, 210, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6ead4";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(40, 24, 28, ${0.15 + (1 - phase) * 0.45})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }

  maybeMeteor();
  if (sky.meteor) {
    const m = sky.meteor;
    ctx.strokeStyle = `rgba(255, 230, 220, ${m.life})`;
    ctx.lineWidth = 1.4 * sky.dpr;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.vx * 2.2, m.y - m.vy * 2.2);
    ctx.stroke();
    m.x += m.vx;
    m.y += m.vy;
    m.life -= 0.02;
    if (m.life <= 0) sky.meteor = null;
  }

  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(6, 3, 10, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function loop(now) {
  drawSky(now || 0);
  requestAnimationFrame(loop);
}
