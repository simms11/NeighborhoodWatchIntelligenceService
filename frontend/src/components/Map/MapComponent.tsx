'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

interface MapProps {
    crimes: any[];
    center: [number, number];
}

export default function MapComponent({ crimes, center }: MapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);


    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current as HTMLElement, {
            zoomControl: true,
            scrollWheelZoom: true,
        }).setView(center, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);

        return () => {

            const mapInstance = mapInstanceRef.current;

            if (mapInstance) {
                mapInstance.remove();
                mapInstanceRef.current = null;
            }
            markersLayerRef.current = null;
        };
    }, []);

    // fly Animation
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;

        map.flyTo(center, 13, {
            animate: true,
            duration: 1.5
        });
    }, [center]);


    useEffect(() => {
        const layerGroup = markersLayerRef.current;

        if (!layerGroup) return;

        layerGroup.clearLayers();

        if (crimes && crimes.length > 0) {
            crimes.forEach((crime) => {
                const lat = Number(crime.location?.latitude);
                const lng = Number(crime.location?.longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    L.marker([lat, lng], { icon: DefaultIcon })
                        .bindPopup(`
                            <div style="font-family: sans-serif; font-size: 13px;">
                                <strong>${crime.category.replace(/-/g, ' ')}</strong><br/>
                                <span style="color: gray;">${crime.location.street?.name}</span>
                            </div>
                        `)
                        .addTo(layerGroup);
                }
            });
        }
    }, [crimes]);

    return <div ref={mapContainerRef} className="h-full w-full outline-none z-0" />;
}