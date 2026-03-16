import React, { useEffect, useRef, useState } from 'react';

declare const L: any;

interface LocationData {
  name: string;
  count: number;
  entries: { year: string; title: string }[];
}

interface Props {
  locations: LocationData[];
}

// Simple geocoding cache to avoid repeated API calls
const geocodeCache = new Map<string, [number, number]>();

async function geocode(place: string): Promise<[number, number] | null> {
  if (geocodeCache.has(place)) return geocodeCache.get(place)!;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`,
      { headers: { 'User-Agent': 'HeritageKeeper/1.0' } }
    );
    const data = await resp.json();
    if (data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache.set(place, coords);
      return coords;
    }
  } catch {
    // Geocoding failed — silently skip this location
  }
  return null;
}

const MapView: React.FC<Props> = ({ locations }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined' || locations.length === 0) return;

    // Destroy previous map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current).setView([30, 0], 2);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Custom purple marker icon
    const purpleIcon = L.divIcon({
      className: 'custom-pin',
      html: '<div style="width:24px;height:24px;background:#7c3aed;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14],
    });

    // Geocode all locations and add markers
    const bounds: [number, number][] = [];

    Promise.all(
      locations.map(async (loc) => {
        const coords = await geocode(loc.name);
        if (coords) {
          bounds.push(coords);
          const popupContent = `
            <div style="font-family:Inter,sans-serif;min-width:150px">
              <strong style="font-size:14px">${loc.name}</strong><br/>
              <span style="color:#666;font-size:12px">${loc.count} ${loc.count === 1 ? 'memory' : 'memories'}</span>
              <hr style="border:none;border-top:1px solid #eee;margin:6px 0"/>
              ${loc.entries.slice(0, 3).map(e => `<div style="font-size:11px;color:#444;margin-bottom:2px"><span style="color:#7c3aed;font-weight:700">${e.year}</span> ${e.title}</div>`).join('')}
              ${loc.entries.length > 3 ? `<div style="font-size:10px;color:#999">+ ${loc.entries.length - 3} more</div>` : ''}
            </div>
          `;
          L.marker(coords, { icon: purpleIcon })
            .addTo(map)
            .bindPopup(popupContent);
        }
      })
    ).then(() => {
      setLoading(false);
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 6);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations]);

  if (locations.length === 0) return null;

  return (
    <div className="map-container fade-in">
      <h4 className="sidebar-card-title purple" style={{ padding: '16px 20px 0' }}>
        &#x1f30d; Family Heritage Map
      </h4>
      <p style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
        {locations.length} {locations.length === 1 ? 'location' : 'locations'} across your family history
        {loading && ' \u2014 loading map...'}
      </p>
      <div ref={mapRef} style={{ height: 350, borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }} />
    </div>
  );
};

export default MapView;
