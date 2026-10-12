# FIA

Asistente de finanzas personales. Le contás a Fia qué gastaste o cobraste en un chat, ella lo anota y te muestra cómo venís. Funciona con reglas explícitas: no usa modelos generativos.

## Cómo está armado

- `src/lib/motor/`: el motor de reglas. Lee importes, fechas, tipos y categorías de un mensaje. Es código puro y tiene pruebas.
- `src/lib/fia/`: la conversación y la voz de Fia.
- `src/lib/datos/`: acceso a la base (Supabase) y una versión en memoria para pruebas y demo.
- `src/components/`: el chat (`/`), el panel (`/panel`) y las tarjetas de movimientos.
- `src/lib/panel.ts`: las cuentas del panel (totales, categorías, día por día, transferencias por persona).
- `src/lib/ocr.ts`: lectura de capturas dentro del navegador (la imagen no sale del celular).
- `supabase/schema.sql`: tablas, permisos y categorías de arranque. Se pega en el SQL Editor de Supabase.

## Desarrollo

```bash
npm install
npm run dev
```

En desarrollo, `http://localhost:3000/demo` abre el chat con datos en memoria, sin iniciar sesión ni tocar la base, y `/demo/panel` abre el panel con movimientos de muestra.

```bash
npm test
```

## Cuenta de usuario

La app no tiene registro: el usuario se crea en Supabase, en Authentication → Users → Add user.
