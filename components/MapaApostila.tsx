"use client";
import Mapa, { type MapaDados } from "./Mapa";
export default function MapaApostila(p: { dados: MapaDados; brasil?: boolean; chaves: Record<string, string> }) {
  return <Mapa {...p} estatico altura={420} />;
}
