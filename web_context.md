# Context del Projecte: Cultural Borders

Aquest document proporciona una visió general del procediment d'extracció i processament de dades realitzat fins ara, així com una descripció del format dels fitxers finals resultants per a la seva integració en una aplicació web.

## 1. Procediment d'Extracció de Dades

El pipeline de dades s'ha dividit en tres branques principals:

### A. Locations i Identificadors
S'ha utilitzat l'API d'autocompletat de **YouTube Music** per identificar i extreure una llista jeràrquica de ~4.700 ubicacions a tot el món, classificades en tres tipus: `COUNTRY`, `SUBCOUNTRY` (estats/províncies) i `CITY`. Cada ubicació té un identificador únic de YouTube (`yt_id`).

### B. Dades Musicals (Charts)
S'ha programat un script de descàrrega paral·lela (10 fils) que consulta els **YouTube Music Charts** per a cada identificador d'ubicació. Les respostes (Top Songs i Top Artists) s'han guardat inicialment en fitxers JSON individuals i posteriorment s'han consolidat en taules CSV.

### C. Geografia i Topologia
S'han obtingut els polígons de cada ubicació mitjançant **Nominatim (OpenStreetMap)**. El repte principal ha estat la unificació topològica:
- S'ha creat un mapa pla on les capes superiors "foraden" les inferiors per evitar encavalcaments de polígons.
- L'ordre de prioritat (de més a menys específic) és: **Cities > Subcountries > Countries**.
- S'ha aplicat una simplificació geomètrica (tolerància de 0.015 graus) per reduir el pes del fitxer per a ús web, tot mantenint la topologia.

---

## 2. Fitxers de Dades Finals

### A. Maps: `combined_map.geojson`
És un fitxer GeoJSON que conté la geometria mundial unificada. Cada element és un polígon únic que no s'encavalca amb cap altre.

**Propietats clau:**
- `yt_id`: ID únic de YouTube per enllaçar amb les dades musicals.
- `yt_name`: Nom de la ubicació.
- `hierarchy_rank`: 0 (City), 1 (Subcountry), 2 (Country). Indica quina capa "mana" en aquell territori.
- `geo_type`: Tipus de geometria original (Polygon/MultiPolygon).

**Exemple de dada (Feature):**
```json
{
  "type": "Feature",
  "properties": {
    "hierarchy_rank": 0,
    "yt_id": "0x95bcca3b4ef90cbd:0xa0b3812e88e88e87",
    "yt_name": "Buenos Aires, Argentina",
    "geo_type": "MultiPolygon"
  },
  "geometry": { ... }
}
```

### B. Music: `data/charts_tracks.csv`
Aquest fitxer conté el llistat consolidat de les cançons més escoltades per a cada ubicació.

**Columnes:**
- `location_id`: Enllaç amb el `yt_id` del GeoJSON.
- `location_name`, `location_type`: Metadades de l'ubicació.
- `rank`: Posició de la cançó al rànquing (1-20).
- `track_name`, `artist_names`: Info de la cançó i intèrprets.
- `view_count`: Nombre de visualitzacions en el període.
- `youtube_url`: Enllaç directe al vídeo de YouTube.
- `thumbnail_url`: URL de la caràtula.

**Exemple de dades (Sample):**
```csv
location_id,location_name,location_type,fetched_at,rank,track_id,track_name,view_count,thumbnail_url,encrypted_video_id,youtube_url,artist_names
0x1a51f24ecaad8b27:0x7f137f563288bd87,"Luanda Province, Angola",SUBCOUNTRY,2026-03-11T14:40:23.357642+00:00,1,G:fGL3GpeZ-tk,TAKA,767450,https://lh3.googleusercontent.com/...,debnm8Ck5DA,https://www.youtube.com/watch?v=debnm8Ck5DA,Echowaya
0x1a51f24ecaad8b27:0x7f137f563288bd87,"Luanda Province, Angola",SUBCOUNTRY,2026-03-11T14:40:23.357642+00:00,2,G:83kWDSS-SLM,Pedaladas,661731,https://lh3.googleusercontent.com/...,FRMHR9Lw8yI,https://www.youtube.com/watch?v=FRMHR9Lw8yI,"DJ Verigal, Sintonia07"
```
