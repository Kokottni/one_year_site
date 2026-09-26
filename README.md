# Our Night Skies

A small romantic website for six remembered nights. It is static HTML, CSS, and JavaScript, so a Raspberry Pi can host it with almost nothing installed.

Each page of the album shows the night sky as it would have looked around **10:30 p.m. local time** from that place on that date: bright stars in real positions, the Milky Way band, and the Moon if it was up. Captions can be edited in the browser; they are saved on that device with `localStorage`.

Use **Create your own night** on the opening screen to search for a place, choose a date and time, and save another sky. Location searches use the public Nominatim search API only when you submit a search (not while typing); results are attributed to OpenStreetMap. The time-zone offset is pre-filled from your device for the selected date, so adjust it when the searched place is in a different time zone. Custom nights and their captions are stored locally in that browser.

## The six skies

1. October 1, 2025 — Madison, Wisconsin  
2. October 11, 2025 — Madison, Wisconsin  
3. December 25, 2025 — Cedarburg, Wisconsin  
4. May 14, 2026 — Punta Cana, Dominican Republic  
5. July 18, 2026 — Keshena, Wisconsin  
6. August 1, 2026 — Middleton, Wisconsin  

## Host on a Raspberry Pi

Copy this folder onto the Pi, then pick one of the options below.

### Quickest: Python

```bash
cd our-night-skies
python3 -m http.server 8080 --bind 0.0.0.0
```

On a phone or laptop on the same Wi-Fi, open `http://PI_HOSTNAME.local:8080` or `http://PI_IP_ADDRESS:8080`.

### Always-on: nginx

```bash
sudo apt update
sudo apt install nginx
sudo cp -r /home/pi/our-night-skies/. /var/www/html/
sudo systemctl enable --now nginx
```

Then visit `http://PI_IP_ADDRESS/`.

If the site lives in its own folder instead of the nginx root:

```nginx
server {
    listen 80 default_server;
    root /home/pi/our-night-skies;
    index index.html;
}
```

## Editing captions

Tap or click the italic text on each night and type. Changes stay in that browser. To start over, clear site data for this page, or run this in the browser console:

```js
localStorage.removeItem("our-night-skies-captions");
```

Optional fonts load from Google Fonts when the Pi or visitor has internet. Without internet, the layout still works with the system serif/sans fallbacks.
