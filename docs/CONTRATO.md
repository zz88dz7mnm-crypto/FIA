# Contrato de datos de FIA

FIA es dueña de los registros financieros (especificación maestra SIVA + AICA, 3.4 y 7). Este documento describe cómo funciona hoy (fase 0: baseline, sin cambios de código) y qué pueden leer SIVA y AICA sin duplicar datos ni reinterpretarlos.

## Tablas que interesan a otros módulos

Todas en `public`, con RLS: cada usuario autenticado ve solo sus filas. Importes en pesos (`numeric(14,2)`, siempre positivos; el signo lo da el tipo). `fecha` es el día local del usuario (`perfiles.zona_horaria`, por defecto `America/Argentina/Buenos_Aires`).

| Tabla | Qué guarda | Notas |
|---|---|---|
| `transacciones` | Cada movimiento: `tipo`, `importe`, `fecha`, `descripcion`, `categoria_id`, `frasco_id`, `contraparte`, `es_interna`, `estado`, `metodo` | El origen (mensaje o captura) queda en `origen_mensaje_id` |
| `categorias` | Nombre y clase (`gasto` / `ingreso`) | `usuario_id` nulo = categoría base, de solo lectura |
| `frascos` + `aportes_frasco` | Plata apartada para algo y lo que se le puso o sacó | |
| `perfiles` | Nombre y zona horaria | |
| `presupuestos`, `metas`, `aportes_meta` | Existen en el esquema | **La app todavía no las usa**: no hay que mostrarlas como datos |

### Tipos y estados

- `tipo`: `gasto` y `transferencia_enviada` son **salidas**; `ingreso` y `transferencia_recibida` son **entradas** (`ES_ENTRADA` en `src/lib/tipos.ts`).
- `estado`: un movimiento entra `en_revision` y **solo cuenta cuando está `confirmada`** (el usuario tocó "Anotar"). `rechazada` y `anulada` no cuentan.
- `es_interna = true`: movimiento entre cuentas propias. **No cuenta** en totales.

## Cómo cuenta FIA (definiciones a respetar)

Sobre los movimientos `confirmada`, `es_interna = false`, con `fecha` dentro del período:

- **Salió**: suma de las salidas (gastos + transferencias enviadas).
- **Entró**: suma de las entradas (ingresos + transferencias recibidas).
- **Te queda**: Entró − Salió. Puede ser negativo.
- **Gasto por categoría**: salidas agrupadas por `categoria_id`; sin categoría (o con una categoría que ya no existe) va a "Sin clasificar".
- **Por día**: salidas y entradas sumadas por `fecha`; los días sin movimientos valen cero.
- **Período "mes"**: del 1 al último día del mes calendario de hoy (en la zona del usuario). "Semana": lunes a domingo.
- **Frasco**: asignado = suma de `aportes_frasco.importe` (positivos y negativos); gastado = salidas `confirmada` con ese `frasco_id`; queda = asignado − gastado.

Fuente: `src/lib/panel.ts` (`totales`, `gastoPorCategoria`, `serie`), `src/lib/datos/supabase.ts` (`confirmadasEntre`, `frascos`) y `src/lib/motor/fechas.ts` (`rangoDe`).

## Para consumidores (SIVA, AICA)

- **Leer** con la sesión del usuario (clave pública + RLS). Nunca con una clave de servicio desde el navegador.
- **No escribir** en tablas de FIA desde otra app (4.3). Si AICA necesita anotar un gasto, lo hará por una operación de FIA, con instrucción explícita y permiso (7.2), cuando se defina en su fase.
- Usar las definiciones de arriba sin reinterpretarlas: el número de SIVA tiene que coincidir con el panel de FIA.
- La API devuelve de a 1000 filas por consulta: paginar si el período puede superar ese número.
- Si la consulta falla, mostrar FIA como "no disponible", nunca como "sin movimientos".

## Pendientes observados (no se cambian en la fase 0)

- `confirmadasEntre` no pagina: un período con más de 1000 movimientos confirmados se cortaría en el chat de FIA. El panel (`movimientosEntre`) sí pagina.
- `presupuestos` y `metas` están en el esquema sin uso en la app.
