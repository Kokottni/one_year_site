const STORAGE_KEY = "our-night-skies-captions";

const intro = document.getElementById("intro");
const nightScreen = document.getElementById("night");
const finale = document.getElementById("finale");
const captionEl = document.getElementById("caption");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

let index = 0;
let screen = "intro";

function loadCaptions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCaption(id, text) {
  const all = loadCaptions();
  all[id] = text;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function captionFor(night) {
  const saved = loadCaptions()[night.id];
  return typeof saved === "string" ? saved : night.defaultCaption;
}

function show(name) {
  screen = name;
  intro.hidden = name !== "intro";
  nightScreen.hidden = name !== "night";
  finale.hidden = name !== "finale";
  document.body.classList.toggle("is-night", name === "night");
}

function renderDots() {
  dotsEl.innerHTML = "";
  NIGHTS.forEach((night, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", night.title);
    btn.className = i === index ? "is-active" : "";
    btn.addEventListener("click", () => goTo(i));
    li.appendChild(btn);
    dotsEl.appendChild(li);
  });
}

function paintNight() {
  const night = NIGHTS[index];
  document.getElementById("night-index").textContent = `Night ${index + 1} of ${NIGHTS.length}`;
  document.getElementById("night-title").textContent = night.title;
  document.getElementById("night-place").textContent = night.place;
  document.getElementById("night-time").textContent = night.timeLabel;
  captionEl.textContent = captionFor(night);
  prevBtn.disabled = index === 0;
  nextBtn.textContent = index === NIGHTS.length - 1 ? "Close" : "Next sky";
  renderDots();
  setNightSky(night);
}

function goTo(i) {
  index = Math.max(0, Math.min(NIGHTS.length - 1, i));
  show("night");
  paintNight();
}

document.getElementById("begin-btn").addEventListener("click", () => goTo(0));
prevBtn.addEventListener("click", () => {
  if (index > 0) goTo(index - 1);
});
nextBtn.addEventListener("click", () => {
  if (index < NIGHTS.length - 1) goTo(index + 1);
  else show("finale");
});
document.getElementById("again-btn").addEventListener("click", () => {
  show("intro");
});
document.getElementById("first-btn").addEventListener("click", () => goTo(0));

captionEl.addEventListener("input", () => {
  saveCaption(NIGHTS[index].id, captionEl.innerText.trim());
});

document.addEventListener("keydown", (event) => {
  if (event.target === captionEl) return;
  if (screen !== "night") return;
  if (event.key === "ArrowRight") nextBtn.click();
  if (event.key === "ArrowLeft") prevBtn.click();
});

initSky();
setNightSky(NIGHTS[0]);
requestAnimationFrame(loop);
