# Cultural Borders — YouTube Music Map 🌍🎵

**Cultural Borders** is a dynamic, interactive world map that visualizes the most popular music across countries, regions, and cities in real-time, powered by **YouTube Music Charts** data.

Inspired by [The Pudding's "Cultural Borders"](https://pudding.cool/2018/06/music-map), this project takes the concept further by offering a live, high-resolution exploration of global musical trends beyond just the #1 track.

## 🌟 Key Features

- **Real-Time Data**: Unlike static monthly snapshots, this map reflects the most recent data available from YouTube Music Charts.
- **Deep Rankings**: Explore beyond the top spot. View Top 20 rankings for each location to discover the musical diversity of a territory.
- **Hierarchical Granularity**: Seamlessly navigate between **Countries**, **Subcountries** (States/Provinces), and **Cities**.
- **Interactive Topology**: A custom-built, non-overlapping map where specific local data (cities) "pierces" through regional and national layers for a perfect, gap-free browsing experience.

## 🛠️ How it Works (The Pipeline)

The project consists of a sophisticated data pipeline designed to handle thousands of locations with minimal overhead:

1.  **Location Discovery**: We extracted ~4,700 unique geographic locations (Countries, Subcountries, and Cities) using the YouTube Music autocomplete internal API.
2.  **Parallel Data Ingestion**: A custom Python engine fetches official charts in parallel (10 threads) for every location, handling thousands of JSON responses efficiently.
3.  **Topological Geometry Processing**:
    *   Fetched high-quality polygons from **OpenStreetMap (Nominatim)**.
    *   Applied a hierarchical "difference" logic: Cities are subtracted from Subcountries, and both are subtracted from Countries. This creates a single-layer "flattened" puzzle.
    *   Geometric simplification (Ramer-Douglas-Peucker) was used to reduce the map size from >600MB to ~15MB for optimal web performance.
4.  **Web Frontend**: A lightweight, responsive interface that loads the consolidated GeoJSON and CSV data to provide a smooth, scrollable, and clickable exploration experience.

## 📊 Data Structure

- **`combined_map.geojson`**: A topological map where each feature contains a `yt_id` linked to the music charts and a `hierarchy_rank` (0 for City, 1 for Subcountry, 2 for Country).
- **`charts_tracks.csv`**: A consolidated dataset containing metadata for ~90,000 song entries, including view counts, thumbnails, and direct YouTube links.

## 🚀 Live Demo

The web application is automatically deployed to GitHub Pages. You can visit the live version here:
[https://catbru.github.io/cultural-borders-yt-charts-web/](https://catbru.github.io/cultural-borders-yt-charts-web/)

---

*Developed as part of the Cultural Borders research project, exploring how music transcends political and geographical boundaries.*
