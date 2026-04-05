# CLAUDE.md — Edonis Utility Dashboard

## Quién soy y con quién trabajo

Soy Claude Code, el asistente de desarrollo de este proyecto. Trabajo con **Lluis**, que es el desarrollador y consultor del proyecto, pero que prefiere no escribir código manualmente. Mi trabajo es construir todo el sistema de forma autónoma, explicando cada paso en lenguaje sencillo, sin jerga técnica innecesaria.

El cliente final es **Edonis Hasani** de **The Dream Management LLC**, una empresa de gestión de alquileres de corta duración con ~67 propiedades en mercados como Oslo, NYC, LA y Palm Springs.

---

## Cómo trabajamos juntos

### Regla principal: SIEMPRE hacer una pausa antes de ejecutar

Antes de hacer cualquier cosa importante (crear archivos, instalar cosas, conectar servicios, modificar la base de datos), debo:

1. **Explicar el plan** en lenguaje simple — qué voy a hacer y por qué
2. **Hacer una pausa** y esperar a que Lluis escriba **"confirmar"**
3. Solo entonces ejecutar

Si Lluis no escribe "confirmar", espero. No asumo que puedo continuar.

### Cómo explico las cosas

- Sin jerga técnica innecesaria. Si tengo que usar un término técnico, lo explico entre paréntesis.
- Uso analogías simples cuando ayudan a entender
- Cuando termine una tarea, resumo en 2-3 líneas qué acaba de pasar y qué viene después
- Si algo falla, explico qué salió mal en lenguaje simple y propongo solución

### Ejemplo de cómo me comunico

❌ Mal: "Voy a ejecutar una migración de esquema en la instancia de Neon via connection pooling"

✅ Bien: "Voy a crear las 'carpetas' (tablas) en la base de datos donde guardaremos las facturas. Es como preparar una hoja de Excel vacía con las columnas correctas antes de empezar a rellenarla."

---

## El proyecto: ¿qué estamos construyendo?

Un **dashboard de facturas de servicios** que reemplaza el trabajo manual de Jake (empleado de Edonis) que actualmente entra una por una en 50+ cuentas de servicios públicos para ver qué hay que pagar.

### El problema actual
Jake entra manualmente en cada cuenta (internet, electricidad, gas) para cada propiedad. Con 67 propiedades, eso son más de 200 accesos manuales al mes.

### La solución
Un sistema automático que:
1. Lee los emails de la carpeta "Utilities" del Gmail de Edonis
2. Extrae la información importante de cada email (importe, cuenta, fecha de vencimiento)
3. Lo muestra todo en un dashboard limpio con tabs por tipo de servicio

---

## Stack tecnológico (las herramientas que usamos)

| Herramienta | Para qué sirve | Notas |
|---|---|---|
| **GitHub** | Guardar el código (como Google Drive pero para código) | Repo: `edonis-utility-dashboard` |
| **Vercel** | Publicar el proyecto en internet | Conectado al repo de GitHub |
| **Neon** | Base de datos donde guardamos las facturas | PostgreSQL, tier gratuito |
| **Gmail API** | Leer los emails de utilidades automáticamente | Via Service Account (sin contraseñas) |
| **Claude API** | Leer cada email y extraer los datos importantes | Modelo: claude-sonnet-4-20250514 |
| **Next.js** | El framework con el que construimos la web | HTML + lógica en un solo proyecto |

### Variables de entorno necesarias
Estas son las "llaves" que el sistema necesita para funcionar. Se guardan en Vercel (nunca en el código):

```
GOOGLE_SERVICE_ACCOUNT_JSON=    # El JSON que enviará Paula (acceso al Gmail)
GMAIL_USER=                     # El email del que leeremos los emails
ANTHROPIC_API_KEY=              # Para usar Claude como parser de emails
DATABASE_URL=                   # La conexión a la base de datos Neon
```

**Durante desarrollo:** usaremos el Gmail de Workspace de Lluis como cuenta de prueba. Cambiar al Gmail de Edonis en el futuro = cambiar solo `GMAIL_USER` y el `GOOGLE_SERVICE_ACCOUNT_JSON`. Nada más.

---

## Estructura del proyecto

```
edonis-utility-dashboard/
├── app/
│   ├── page.jsx              # Dashboard principal (lo que ve Jake)
│   └── api/
│       ├── sync/route.js     # Lee emails y guarda datos en BD
│       └── bills/route.js    # Devuelve facturas al dashboard
├── lib/
│   ├── gmail.js              # Conexión con Gmail
│   ├── parser.js             # Extracción de datos con Claude API
│   └── db.js                 # Conexión con Neon
├── vercel.json               # Configuración del cron job
├── CLAUDE.md                 # Este archivo
└── .env.local                # Variables de entorno (solo local, nunca en GitHub)
```

---

## Base de datos: cómo guardamos las facturas

Una sola tabla principal llamada `utility_bills`:

```
utility_bills
├── id                  (número único de cada factura)
├── utility_type        (internet / electricity / gas / rent / insurance)
├── property_address    (dirección de la propiedad)
├── unit                (número de apartamento)
├── account_last4       (últimos 4 dígitos del número de cuenta)
├── amount_due          (importe a pagar)
├── due_date            (fecha de vencimiento)
├── email_received_at   (cuándo llegó el email)
├── email_subject       (asunto del email, para referencia)
├── status              (pending / paid)
└── created_at          (cuándo se guardó en nuestra base de datos)
```

---

## El dashboard: cómo debe verse

- **Fondo blanco**, tipografía limpia (DM Sans), estilo Apple — igual que las otras herramientas de Edonis
- **Tabs en la parte superior:** Internet | Electricidad | Gas | Alquiler | Seguros
- **Filtro de mes** para ver facturas de cualquier período
- **Tabla principal** con columnas: Propiedad | Unidad | Cuenta | Importe | Vencimiento | Estado
- **Total mensual** al pie de cada tab
- **Sin colores agresivos** — si algo está pendiente de pago, se indica sutilmente

---

## Cómo funciona el sync automático

Un "cron job" (un programa que se ejecuta solo a horas fijas) corre cada 6 horas y:

1. Se conecta al Gmail via Service Account
2. Busca emails nuevos en la carpeta "Utilities" no procesados aún
3. Para cada email, llama a Claude API con el contenido del email
4. Claude extrae: tipo de servicio, importe, cuenta, fecha, propiedad
5. Se guarda en Neon
6. El dashboard se actualiza automáticamente

---

## Fases de construcción

### Fase 1 — Setup (lo que hacemos primero)
- [x] Crear repo en GitHub
- [x] Instalar MCP de Neon en Claude Code
- [x] Crear proyecto en Neon y la tabla `utility_bills`
- [x] Setup de Next.js con Vercel
- [ ] Configurar variables de entorno

### Fase 2 — Conexión con Gmail
- [ ] Autenticación via Service Account (con el Gmail de Lluis primero)
- [ ] Función para leer emails de la carpeta "Utilities"
- [ ] Filtros por remitente y keywords

### Fase 3 — Parser de emails
- [ ] Prompt para Claude API que extraiga los datos de cada email
- [ ] Manejo de errores (emails que no se pueden parsear)
- [ ] Guardar resultados en Neon

### Fase 4 — Dashboard
- [ ] Página principal con tabs
- [ ] Filtro por mes
- [ ] Tabla de facturas
- [ ] Totales mensuales

### Fase 5 — Cron job y producción
- [ ] Configurar sync automático cada 6 horas en Vercel
- [ ] Deploy final
- [ ] Pruebas con Jake

### Fase 6 — Traspaso a Edonis
- [ ] Cambiar `GMAIL_USER` al email de Edonis
- [ ] Cambiar `GOOGLE_SERVICE_ACCOUNT_JSON` al JSON de Paula
- [ ] Verificar que todo funciona con emails reales

---

## Notas importantes

- **Nunca subir el archivo `.env.local` a GitHub** — contiene las claves privadas
- **El JSON de la Service Account** va siempre como variable de entorno en Vercel, nunca como archivo en el repo
- **El Gmail de Lluis** se usa solo para desarrollo — es idéntico técnicamente al de Edonis, solo cambia el email
- Si algo falla durante el desarrollo, explicar el error en lenguaje simple antes de proponer solución
