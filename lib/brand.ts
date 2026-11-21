/**
 * Rutas de marca. El teal #25656F es el color más frecuente del fondo
 * de los PNG oficiales (rgb 37, 101, 111).
 * Las variantes "on light" reutilizan el dibujo blanco, recoloreado a ese teal
 * y sobre transparencia, para fondos claros.
 */
export const brand = {
  horizontal: "/brand/logo-horizontal.png",
  stacked: "/brand/logo-stacked.png",
  wordmark: "/brand/logo-wordmark.png",
  mark: "/brand/logo-mark.png",
  outline: "/brand/logo-outline-transparent.png",
  horizontalOnLight: "/brand/logo-horizontal-on-light.png",
  markOnLight: "/brand/logo-mark-on-light.png",
  color: "#25656F",
  colorDeep: "#1A4C54",
  gold: "#C4A15A",
} as const;

export const legalEntity = {
  name: "South Wind Global Services LLC",
  shortName: "South Wind",
  jurisdiction: "Montana, Estados Unidos",
  addressLines: [
    "Domicilio registrado: [completar dirección en Montana]",
    "Montana, Estados Unidos",
  ],
} as const;
