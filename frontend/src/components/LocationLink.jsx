export default function LocationLink({ latitude, longitude }) {
  if (
    latitude === null || latitude === undefined || longitude === null || longitude === undefined
    || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))
  ) {
    return null;
  }

  const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  return (
    <a className="location-link" href={mapUrl} target="_blank" rel="noreferrer">
      View location on map <span aria-hidden="true">↗</span>
    </a>
  );
}
