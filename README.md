# FIA

Asistente de finanzas personales. Le contás a Fia qué gastaste o cobraste en un chat, ella lo anota y te muestra cómo venís. Funciona con reglas explícitas: no usa modelos generativos.

## Cómo está armado

- `src/lib/motor/`: el motor de reglas. Lee importes, fechas, tipos y categorías de un mensaje. Es código puro y tiene pruebas.
- `src/lib/fia/`: la conversación y la voz de Fia.
- `src/lib/datos/`: acceso a la base (Supabase) y una versión en memoria para pruebas y demo.
- `src/components/`: la pantalla del chat, los tickets y el personaje.
- `supabase/schema.sql`: tablas, permisos y categorías de arranque. Se pega en el SQL Editor de Supabase.

## Desarrollo

```bash
npm install
npm run dev
```

En desarrollo, `http://localhost:3000/demo` abre el chat con datos en memoria, sin iniciar sesión ni tocar la base.

```bash
npm test
```

## Cuenta de usuario

La app no tiene registro: el usuario se crea en Supabase, en Authentication → Users → Add user.
