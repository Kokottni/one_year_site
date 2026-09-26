const STORAGE_KEY = "our-night-skies-captions";
const CUSTOM_NIGHTS_KEY = "our-night-skies-custom-nights";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const intro = document.getElementById("intro");
const createScreen = document.getElementById("create-night");
const nightScreen = document.getElementById("night");
const finale = document.getElementById("finale");
const captionEl = document.getElementById("caption");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const locationQuery = document.getElementById("location-query");
const locationStatus = document.getElementById("location-status");
const locationResults = document.getElementById("location-results");
const searchLocationBtn = document.getElementById("search-location-btn");
const saveNightBtn = document.getElementById("save-night-btn");
const dateInput = document.getElementById("night-date");
const timeInput = document.getElementById("night-time-input");
const offsetInput = document.getElementById("utc-offset");
const builderForm = document.getElementById("night-builder");

let index = 0;
let screen = "intro";
let selectedLocation = null;
let lastLocationSearchAt = 0;

function loadCustomNights() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_NIGHTS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

NIGHTS.push(...loadCustomNights());

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
  return night.defaultCaption;
}

function show(name) {
  screen = name;
  intro.hidden = name !== "intro";
  createScreen.hidden = name !== "create-night";
  nightScreen.hidden = name !== "night";
  finale.hidden = name !== "finale";
  document.body.classList.toggle("is-night", name === "night");
}

function deviceOffsetForDate(dateValue) {
  if (!dateValue) return 0;
  return -new Date(`${dateValue}T12:00:00`).getTimezoneOffset() / 60;
}

function openCreateScreen() {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  dateInput.value = localDate;
  offsetInput.value = deviceOffsetForDate(localDate);
  timeInput.value = "22:30";
  document.getElementById("night-caption").value = "";
  locationQuery.value = "";
  locationResults.replaceChildren();
  selectedLocation = null;
  saveNightBtn.disabled = true;
  locationStatus.textContent = "Search for a place, then choose the matching result.";
  show("create-night");
  locationQuery.focus();
}

function placeLabel(result) {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.hamlet || address.municipality;
  const region = address.state || address.province || address.country;
  const parts = [city, region].filter(Boolean);
  if (parts.length) return [...new Set(parts)].join(", ");
  return result.name || result.display_name || "Selected place";
}

function clearSelectedLocation() {
  selectedLocation = null;
  saveNightBtn.disabled = true;
  locationResults.replaceChildren();
}

async function searchLocations() {
  const query = locationQuery.value.trim();
  if (!query) {
    locationStatus.textContent = "Enter a city, landmark, or address to search.";
    locationQuery.focus();
    return;
  }
  if (Date.now() - lastLocationSearchAt < 1000) {
    locationStatus.textContent = "Please wait a moment before searching again.";
    return;
  }

  lastLocationSearchAt = Date.now();
  searchLocationBtn.disabled = true;
  locationQuery.disabled = true;
  clearSelectedLocation();
  locationStatus.textContent = "Searching for places…";
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    "accept-language": "en",
  });

  try {
    const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`);
    if (!response.ok) throw new Error(`Search failed (${response.status}).`);
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      locationStatus.textContent = "No matching places found. Try a more specific search.";
      return;
    }

    locationStatus.textContent = "Choose the place that matches your memory.";
    results.forEach((result) => {
      const lat = Number(result.lat);
      const lon = Number(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "location-option";
      button.textContent = result.display_name || placeLabel(result);
      button.addEventListener("click", () => {
        selectedLocation = { lat, lon, place: placeLabel(result) };
        locationResults.querySelectorAll(".location-option").forEach((option) => {
          option.classList.toggle("is-selected", option === button);
          option.setAttribute("aria-pressed", String(option === button));
        });
        saveNightBtn.disabled = false;
        locationStatus.textContent = `Selected: ${selectedLocation.place}`;
      });
      button.setAttribute("aria-pressed", "false");
      item.appendChild(button);
      locationResults.appendChild(item);
    });
    if (!locationResults.children.length) {
      locationStatus.textContent = "No usable place coordinates found. Try another search.";
    }
  } catch (error) {
    locationStatus.textContent = `${error.message} Check your connection and try again.`;
  } finally {
    searchLocationBtn.disabled = false;
    locationQuery.disabled = false;
  }
}

function formatTimeLabel(time, offsetHours) {
  const [hours, minutes] = time.split(":").map(Number);
  const hour12 = hours % 12 || 12;
  const meridiem = hours < 12 ? "AM" : "PM";
  const offsetMinutes = Math.round(offsetHours * 60);
  const sign = offsetMinutes < 0 ? "−" : "+";
  const absOffset = Math.abs(offsetMinutes);
  const offsetLabel = `${sign}${String(Math.floor(absOffset / 60)).padStart(2, "0")}:${String(absOffset % 60).padStart(2, "0")}`;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem} · UTC${offsetLabel}`;
}

function createNight(event) {
  event.preventDefault();
  if (!selectedLocation) {
    locationStatus.textContent = "Search for and select a place before saving your night.";
    locationQuery.focus();
    return;
  }
  if (!builderForm.reportValidity()) return;

  const [year, month, day] = dateInput.value.split("-").map(Number);
  const [hours, minutes] = timeInput.value.split(":").map(Number);
  const offsetHours = Number(offsetInput.value);
  const utc = new Date(Date.UTC(year, month - 1, day, hours, minutes) - offsetHours * 60 * 60 * 1000);
  const title = new Date(year, month - 1, day, 12).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const night = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    place: selectedLocation.place,
    timeLabel: formatTimeLabel(timeInput.value, offsetHours),
    utc: utc.toISOString(),
    lat: selectedLocation.lat,
    lon: selectedLocation.lon,
    glow: 0.5,
    milky: 0.55,
    defaultCaption: document.getElementById("night-caption").value.trim() || "A night worth remembering.",
  };

  NIGHTS.push(night);
  try {
    localStorage.setItem(CUSTOM_NIGHTS_KEY, JSON.stringify(NIGHTS.filter((item) => item.id.startsWith("custom-"))));
  } catch {
    locationStatus.textContent = "This night was added, but your browser could not save it for next time.";
  }
  goTo(NIGHTS.length - 1);
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
document.getElementById("create-night-end-btn").addEventListener("click", openCreateScreen);
document.getElementById("first-btn").addEventListener("click", () => goTo(0));

captionEl.addEventListener("input", () => {
  saveCaption(NIGHTS[index].id, captionEl.innerText.trim());
});

document.getElementById("create-night-btn").addEventListener("click", openCreateScreen);
document.getElementById("cancel-create-btn").addEventListener("click", () => show("intro"));
searchLocationBtn.addEventListener("click", searchLocations);
locationQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchLocations();
  }
});
locationQuery.addEventListener("input", clearSelectedLocation);
dateInput.addEventListener("change", () => {
  offsetInput.value = deviceOffsetForDate(dateInput.value);
});
builderForm.addEventListener("submit", createNight);

document.addEventListener("keydown", (event) => {
  if (event.target === captionEl) return;
  if (screen !== "night") return;
  if (event.key === "ArrowRight") nextBtn.click();
  if (event.key === "ArrowLeft") prevBtn.click();
});

initSky();
setNightSky(NIGHTS[0]);
requestAnimationFrame(loop);
