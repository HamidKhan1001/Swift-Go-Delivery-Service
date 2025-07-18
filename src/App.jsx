import { useEffect, useState, useRef } from "react";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;

function App() {
  const [locationText, setLocationText] = useState("Detecting your location...");
  const [whatsAppLink, setWhatsAppLink] = useState("");
  const mapRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationText("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          const data = await response.json();

          const address =
            data.results[0]?.formatted_address ||
            `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

          setLocationText(address);

          const message = `Hi Tabedaar, I need bike service at:\n${address}\n${mapsLink}`;
          setWhatsAppLink(
            `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
          );

          if (window.google && window.google.maps && mapRef.current) {
            const position = { lat: latitude, lng: longitude };

            const map = new window.google.maps.Map(mapRef.current, {
              center: position,
              zoom: 17,
              mapTypeControl: true,
              zoomControl: true,
              fullscreenControl: true,
              streetViewControl: false,
              mapTypeId: "roadmap",
              styles: [
                { featureType: "all", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
                { featureType: "poi", elementType: "geometry.fill", stylers: [{ color: "#cbd1db" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#b4d4e1" }] },
              ],
            });

            const marker = new window.google.maps.Marker({
              position,
              map,
              title: "Your Location",
              animation: google.maps.Animation.DROP,
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `<div style="font-size:14px; font-weight:bold; color:#333;">📍 ${address}</div>`,
            });

            marker.addListener("click", () => {
              infoWindow.open(map, marker);
            });

            infoWindow.open(map, marker);
          }
        } catch (err) {
          setLocationText("Unable to fetch address. Try again later.");
        }
      },
      () => {
        setLocationText("Permission denied or location unavailable.");
      }
    );
  }, []);

  return (
    <div className="container">
      <h1>🚴 Tabedaar Bike Service</h1>
      <p>We’ve detected your location:</p>
      <div className="location-info">📍 <strong>{locationText}</strong></div>
      <div id="map" ref={mapRef}></div>
      {whatsAppLink && (
        <a
          className="whatsapp-btn"
          href={whatsAppLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share Location on WhatsApp
        </a>
      )}
      <p className="tip">
        📌 You can also send your Live Location manually in WhatsApp for best accuracy.
      </p>
    </div>
  );
}

export default App;
