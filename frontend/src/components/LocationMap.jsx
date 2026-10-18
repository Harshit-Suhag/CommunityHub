import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER = [28.4595, 77.0266];

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng);
    },
  });
  return null;
}

export function LocationMap({ latitude, longitude, onChange, height = 300 }) {
  const hasPin = latitude !== '' && latitude !== null && latitude !== undefined
    && longitude !== '' && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const position = hasPin
    ? [Number(latitude), Number(longitude)]
    : DEFAULT_CENTER;

  const style = useMemo(() => ({ height }), [height]);

  return (
    <div className="location-map-shell">
      <MapContainer
        center={position}
        zoom={hasPin ? 16 : 13}
        scrollWheelZoom={false}
        style={style}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPin && <Marker position={position} icon={pinIcon} />}
        {onChange && (
          <MapClickHandler
            onSelect={({ lat, lng }) => onChange({ latitude: lat.toFixed(7), longitude: lng.toFixed(7) })}
          />
        )}
      </MapContainer>
      {onChange && (
        <div className="location-map-hint">
          Click the map to {hasPin ? 'move' : 'place'} the pin. Map data © OpenStreetMap contributors.
          {hasPin && (
            <button type="button" className="location-clear" onClick={() => onChange({ latitude: '', longitude: '' })}>
              Remove pin
            </button>
          )}
        </div>
      )}
    </div>
  );
}
