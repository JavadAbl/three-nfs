"""Find Poly Haven HDRIs suitable for the island map's clean sky.

Criteria: outdoor natural setting, day/morning/noon, clear or few clouds,
ideally beach/coast/sea/tropical. Must NOT be shot from a building/balcony
(that's how illovo_beach_balcony got its structure baked in).
"""
import json
import urllib.request

data = json.loads(urllib.request.urlopen("https://api.polyhaven.com/assets?type=hdris", timeout=30).read())

WANT_CATS = ["beach", "coast", "sea", "ocean", "tropical", "island", "summer", "park", "nature"]
WANT_TOD = ["day", "morning", "noon", "afternoon"]
CLEAR = ["clear", "few clouds", "partly cloudy"]

rows = []
for key, a in data.items():
    attrs = a.get("attributes", {})
    tod = attrs.get("time_of_day", "")
    weather = attrs.get("weather", "")
    cats = " ".join(a.get("categories", [])).lower()
    if tod not in WANT_TOD:
        continue
    if weather not in CLEAR:
        continue
    if not any(w in cats for w in WANT_CATS):
        continue
    rows.append((key, a.get("name"), tod, weather, a.get("categories", [])))

print(f"{len(rows)} candidates:\n")
for k, name, tod, weather, cats in sorted(rows, key=lambda r: r[2]):
    print(f"{k:35s} {name!r:45s} tod={tod:10s} weather={weather:15s} cats={cats}")

print("\n--- all BEACH/TROPICAL regardless of weather ---")
for key, a in data.items():
    cats = " ".join(a.get("categories", [])).lower()
    if any(w in cats for w in ["beach", "tropical", "island", "coast"]):
        attrs = a.get("attributes", {})
        print(
            f"{key:35s} tod={attrs.get('time_of_day','?'):10s} "
            f"weather={attrs.get('weather','?'):15s} name={a.get('name')}"
        )
