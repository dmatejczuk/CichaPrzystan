
import requests
import json

url = "http://localhost:3000/api/test/"

# Konkretny obiekt znaleziony wcześniej w OSM
osm_type = "way"
osm_id = 995827712

osm_url = f"https://api.openstreetmap.org/api/0.6/{osm_type}/{osm_id}/full.json"

session = requests.Session()

session.headers.update({
    "User-Agent": "ChatBotApi/1.0 (OSM research test)",
    "Accept": "application/json"
})

try:
    print("Pobieranie obiektu z OpenStreetMap...")

    # Pobranie konkretnego obiektu, bez Overpass
    response = session.get(
        osm_url,
        timeout=30
    )

    response.raise_for_status()

    osm_data = response.json()

    if not osm_data.get("elements"):
        raise Exception("Nie znaleziono obiektu OSM.")

    osm_object = osm_data["elements"][0]

    print("\nPobrany obiekt:")
    print(json.dumps(osm_object, indent=4, ensure_ascii=False))

    print("\nWysyłanie do ChatBotApi...")

    response = session.post(
        url,
        json={"data": osm_object},
        timeout=180
    )

    print("Status:", response.status_code)

    try:
        result = response.json()
    except ValueError:
        print("Odpowiedź serwera:", response.text)
        raise

    print("\nOdpowiedź API:")
    print(json.dumps(result, indent=4, ensure_ascii=False))

except requests.ConnectionError:
    print("Nie można połączyć się z serwerem.")

except requests.Timeout:
    print("Przekroczono limit czasu.")

except requests.HTTPError as e:
    print("Błąd HTTP:", e)

except Exception as e:
    print("Błąd:", e)
