# Plan: pestañas de Insurance y Rent

> **Estado:** documento de planificación. Ninguna de las dos pestañas está implementada.
> **Fecha de la investigación:** 29 de abril de 2026
> **Cuenta investigada:** `login@thedreammanagement.com` (Edonis)

---

## ⚠️ Conclusión rápida (lee esto primero)

Después de mirar el Gmail de Edonis, **no podemos copiar el método de utilities tal cual**.

- **Insurance:** prácticamente **no llegan facturas de seguros al Gmail** (solo 1 conversación irrelevante de Lemonade y un caso personal de auto-insurance). No hay proveedores típicos de seguros de propiedad enviando emails.
- **Rent:** **no llegan recibos de alquiler al Gmail**. Jake confirmó en la reunión que tiene que entrar manualmente a los portales para pagarlos.

Antes de construir nada, necesitamos respuestas de Edonis (ver "Preguntas para Edonis" más abajo). Según las respuestas, hay 3 caminos posibles para cada uno.

---

## 🔍 Lo que se hizo en la investigación

Se creó un script (`scripts/investigate-emails.mjs`) que se conectó al Gmail de Edonis usando el token OAuth que ya teníamos guardado. Buscó:

1. **Las 22 etiquetas existentes** del Gmail (carpetas que usa Edonis para organizar el correo)
2. **Insurance:** 14 búsquedas distintas (palabras clave + 11 proveedores típicos como Allstate, State Farm, Geico, Lemonade, Hippo, Steadily, Obie, Proper, etc.) desde el 1 de octubre de 2025
3. **Rent:** 13 búsquedas distintas (palabras clave + 12 plataformas típicas como Buildium, AppFolio, Yardi, RentCafe, Avail, etc.) desde el 1 de octubre de 2025

### Etiquetas del Gmail de Edonis (las 22 existentes)

```
0 - PAYOUTS, 0 - URGENT, AIRTABLE, BILLSHARK, BNBTALLY, BOFA,
DOB ALERTS, GODADDY, INVOICE APPROVALS, MAKE, MANUS, NORTHWEST,
PAYPAL, PERMITS, QUICKBOOKS, RECEPTIONHQ, REVYOOS, STRIPE, TWILIO,
UTILITIES, WEMAKEFUTURE, WISE
```

**No existe** una etiqueta dedicada a "Insurance" ni a "Rent". `BILLSHARK` (servicio de negociación de facturas) y `INVOICE APPROVALS` podrían ser pistas, pero hay que confirmar con Edonis.

---

## 🛡️ INSURANCE — qué encontramos

### Hallazgos

| Búsqueda | Resultados |
|---|---|
| Palabra "insurance" | 5 emails (4 son irrelevantes — auto insurance personal de Francisco/Juan, no propiedades) |
| "policy renewal" / "your policy" | 3 emails (todos repetidos del bloque anterior) |
| Proveedor Allstate, State Farm, Geico, Liberty Mutual, Progressive, Travelers, Farmers, Nationwide, Hippo, Steadily, Obie, Proper | **0 resultados en todos** |
| Proveedor Lemonade | 3 emails — pero son: 1 de cancelación de un renters insurance personal y 2 de "tu password" |

**Un email tipo:** `Kemper Auto insurance policy documents are ready` — sin etiqueta, no parece factura de propiedad.

### Las 3 opciones técnicas para Insurance

#### Opción A — Si las facturas llegan por email (a investigar con Edonis)
Mismo método que utilities. Pasos:
1. Edonis nos confirma a qué cuenta llegan
2. Crea/usa una etiqueta (ej: `INSURANCE`) y mueve los emails ahí
3. Ampliamos el sync para procesar esa etiqueta
4. Claude Haiku extrae: provider, property, premium, renewal_date

**Coste:** 1-2 días de desarrollo + ~$0.50/mes adicionales en Claude API

#### Opción B — Si solo aparecen en banco / QuickBooks
Habría que **integrar con QuickBooks API** (la conversación que ya estás teniendo con sus desarrolladores). Cruzar transacción bancaria con catálogo de pólizas que Edonis nos pase en Excel.

**Coste:** 5-10 días de desarrollo (depende del acceso que den)

#### Opción C — Si llegan por portal web del proveedor
Scraping del portal. **No recomendado** — frágil, lento, mantenimiento alto.

### Preguntas para Edonis (Insurance)

1. ¿Cómo te llegan hoy las facturas de seguros de las propiedades? (¿email? ¿correo postal? ¿portal web del proveedor? ¿solo lo ves en el banco?)
2. ¿Si llegan por email, a qué cuenta van? ¿`login@thedreammanagement.com` u otra?
3. ¿Cuántas pólizas activas hay en total? (orientativo: 67 propiedades = ¿una póliza por propiedad? ¿varias agrupadas?)
4. ¿Quiénes son los proveedores principales? (no aparecen los típicos en el Gmail)
5. ¿Cómo se pagan? (cargo automático del banco, tarjeta, transferencia manual)

---

## 🏠 RENT — qué encontramos

### Hallazgos

| Búsqueda | Resultados |
|---|---|
| "rent" / "lease" / "landlord" / "monthly rent" | 4 emails — todos **falsos positivos** (alertas de SCE sobre "energy use compared to similar homes") |
| "rent payment" / "rent receipt" / "payment confirmation" | 5 emails — son de **FiBrick** (servicio de invoicing, no rent) y Host Compliance (LA city fee) |
| Buildium, AppFolio, RentManager, Yardi, RentCafe, TenantCloud, Avail, Cozy, Apartments.com, PayLease, Zego, Stripe, PayPal, Zelle | **0 resultados en todos** |

**Esto coincide con lo que dijo Jake:** *"Tengo que entrar una por una en las webs porque el importe cambia cada mes."*

→ Edonis **no recibe los recibos de rent por email**. Los pagos se inician desde portales web.

### Las 3 opciones técnicas para Rent

#### Opción A — Confirmación por email tras hacer el pago (a investigar con Edonis)
Si tras pagar en el portal sí se recibe un email de confirmación, podemos parsear ese email. Pero la búsqueda no encuentra nada típico — habría que mirar carpeta por carpeta o que Edonis nos enseñe un ejemplo.

**Coste:** 2-3 días si los emails existen y son consistentes

#### Opción B — Carga manual desde Excels históricos (RECOMENDADO PARA EMPEZAR)
Edonis nos pasa los Excels de los últimos 3-6 meses de pagos de rent. Hacemos un importador. La pestaña Rent muestra histórico. Para los meses futuros, Jake (o automatización) sube un nuevo Excel cada mes.

**Coste:** 2-3 días — la opción más realista a corto plazo
**Beneficio extra:** ese histórico es justo lo que pediste para que el sistema "aprenda" qué pago corresponde a qué unidad cuando hagamos QuickBooks API

#### Opción C — QuickBooks API + mapeo "cuenta del portal → unidad"
Cuando tengamos acceso a QuickBooks API, leemos las transacciones bancarias. Aplicamos un mapeo (igual que el de electricidad/gas en Fase 6) que dice "este pago de $X de este portal va a esta unidad".

**Coste:** depende del acceso a QuickBooks. Combinable con Opción B (B nos da el mapeo histórico que C necesita).

### Preguntas para Edonis (Rent)

1. ¿En qué portales pagáis los rents? (lista de URLs/nombres). Jake habló de Airtable + códigos de verificación — necesitamos saber qué portales son
2. Tras pagar en cada portal, ¿llega un email de confirmación a alguna cuenta? ¿A cuál? ¿Hay carpeta donde se guarden?
3. ¿Tenéis Excels mensuales con los pagos de rent? (sería el atajo más rápido)
4. ¿El importe varía cada mes para todas las unidades, o solo para algunas?
5. ¿Cuántas unidades pagan rent al mes? (¿son las 67 propiedades o un subconjunto?)

---

## 🎨 Cómo se verán las pestañas (cuando se construyan)

### Pestaña Insurance
Probablemente **no como matriz** (como utilities) sino como **lista** — porque las pólizas no se pagan mensualmente sino con renovación anual/semestral.

```
Provider     | Property              | Policy #  | Premium | Renewal    | Status
─────────────┼───────────────────────┼───────────┼─────────┼────────────┼────────
Steadily     | 123 Main St, NYC      | POL-12345 | $1,200  | 2026-09-15 | Active
Hippo        | 456 Sunset Blvd, LA   | POL-67890 | $850    | 2026-12-01 | Active
```

### Pestaña Rent
**Matriz mensual** parecida a utilities, con una sola columna de importe + estado:

```
Property               | Unit | Date paid  | Rent       | Status
───────────────────────┼──────┼────────────┼────────────┼────────
123 Main St, NYC       | 4B   | Apr 1      | $3,200.00  | Paid
456 Sunset Blvd, LA    | 12   | Apr 3      | $2,850.00  | Paid
```

Filtro de mes igual que la pestaña actual de utilities.

---

## 💰 Estimación de coste (orientativo)

| Caso | Desarrollo | Operación mensual |
|---|---|---|
| Insurance — Opción A (email) | 1-2 días | ~$0.50/mes Claude API |
| Insurance — Opción B (QuickBooks) | 5-10 días | ~$0/mes |
| Rent — Opción A (email confirmación) | 2-3 días | ~$1/mes Claude API |
| Rent — Opción B (Excels manuales) | 2-3 días | $0/mes |
| Rent — Opción C (QuickBooks) | 5-10 días | ~$0/mes |

---

## 🚀 Recomendación de orden

1. **Hacer las preguntas a Edonis** (ver listas arriba) — sin esto, cualquier estimación es a ciegas
2. **Pedirle Excels** de los últimos 3 meses (rent + insurance) — útiles en cualquier escenario
3. **Decidir** según las respuestas:
   - Si rent llega por email → ir a Rent Opción A (3 días)
   - Si no → empezar con Rent Opción B (importador de Excels) y dejar la automatización para cuando tengamos QuickBooks API
4. Para Insurance, **decidir según volumen**: si son 5-10 pólizas al año, quizás no compense automatizar nada y basta con un formulario de carga manual

---

## 📁 Archivos relevantes

- Script de investigación: `scripts/investigate-emails.mjs` (se puede ejecutar de nuevo cuando Edonis dé pistas nuevas)
- Resultado de la investigación: `investigation.txt` (detalle por búsqueda)
