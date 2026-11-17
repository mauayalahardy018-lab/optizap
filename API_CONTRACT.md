# API_CONTRACT.md - Contrato de Datos y Server Actions (Optizap)

Contrato compartido entre Backend (`feat/backend`) y Frontend (`feat/frontend`).
Fuente de tipos: `src/types/database.ts`. Migración inicial:
`supabase/migrations/20261117230647_optizap_initial_schema.sql`.
Funciones de servicios: `supabase/migrations/20261117233231_service_rpcs.sql`.

## 1. Estado e invariantes

- La migración está preparada para una base Supabase nueva. No se ha aplicado al proyecto remoto; esta entrega solo publica archivos en GitHub.
- La capa Next.js agrega servicios en `src/services`, un cliente SSR en `src/lib/supabase/server.ts` y Route Handlers bajo `/api`; ver sección 6. Los endpoints directos de tablas de la sección 4 pertenecen a la Data API de Supabase. Ambos requieren aplicar las migraciones antes de usarlos.
- Se conserva `UserRole = 'admin' | 'optometrista' | 'vendedor' | 'cliente'`. **`vendedor` representa Recepción/Ventas**; no enviar `recepcion`.
- Todas las tablas tienen RLS, UUID como PK, `created_at` y `updated_at` (`timestamptz`, asignados por defecto; un trigger actualiza `updated_at`).
- Fechas con hora: cadenas ISO 8601 con offset; almacenar como `timestamptz`, presentar en `America/Mexico_City`. `birth_date` usa `YYYY-MM-DD`.
- Precios: `numeric(12,2)`, no negativos, moneda fija `MXN`. Precio de armazón por pieza; precio de mica por **una mica**, no por par. No usar cálculos monetarios del cliente para autorizar cobros.
- Medidas en mm, graduaciones en dioptrías y eje en grados. Los campos opcionales sin default son `null` en las filas.
- `Tables<T>`, `TablesInsert<T>` y `TablesUpdate<T>` describen el esquema, no otorgan permisos. No enviar objetos de vista completos como escrituras.
- `Brand.frames_count` y `Frame.brand` son proyecciones opcionales; no son columnas y no aparecen en los tipos Row/Insert/Update de las tablas.
- Los helpers de autorización y triggers viven en `private`, fuera de los esquemas expuestos. La autorización consulta el rol actual en `profiles`, nunca roles de `user_metadata`.

## 2. Tablas: entradas y salidas

En las entradas siguientes, UUID y timestamps se generan salvo cuando se indique lo contrario. La respuesta completa de cada fila corresponde a `Tables<'nombre_tabla'>`; incluye `id`, los campos listados y ambos timestamps.

### profiles → UserProfile

- PK `id`: FK a `auth.users.id`, con borrado en cascada del perfil.
- Salida: `id, email, full_name, role, avatar_url, created_at, updated_at`.
- Alta: trigger al registrar un usuario en Supabase Auth; rol **siempre cliente**. `full_name` se toma del texto de metadata, sin usarlo para autorización. Se incluyen usuarios Auth preexistentes mediante backfill.
- Cambio de email: únicamente desde Supabase Auth, sincronizado por trigger.
- Actualización de perfil autenticada: `{ full_name?, avatar_url? }` sobre el perfil propio; Admin puede hacerlo sobre cualquier perfil.
- Asignación de rol: Admin puede enviar `{ role: UserRole }` a otro perfil o al propio. Se rechaza escalamiento por cualquier otro rol, incluso mediante acceso directo a la Data API.
- Primer Admin: un operador debe asignarlo con SQL confiable, después de que el usuario se haya registrado: `update public.profiles set role = 'admin' where id = '<UUID de Auth>';`. La migración no crea cuentas ni credenciales administrativas.
- No hay INSERT/DELETE de perfiles para clientes de la Data API; tampoco UPDATE de `id`, email o timestamps.

### brands → Brand

- Entrada requerida: `{ name, slug }`.
- Opcionales: `logo_url, description, country, category, is_active` (default true).
- `slug` único, minúsculas alfanuméricas separadas por guiones; nombre no vacío.
- `category`: `lujo | deportivo | moda | accesible | infantil | null`.
- Salida: `id, name, slug, logo_url, description, country, category, is_active, created_at, updated_at`.
- La migración incluye Ray-Ban, Oakley, Persol, Tom Ford, Essilor y ZEISS, identificadas por slugs `ray-ban, oakley, persol, tom-ford, essilor, zeiss`. No incluye precios o productos ficticios.

### frames → Frame

- Entrada requerida: `{ brand_id, sku, name, material, shape, color, lens_width_mm, bridge_width_mm, temple_length_mm, price }`.
- Opcionales: `gender` (unisex), `lens_height_mm` (null), `stock` (0), `image_url` (null), `is_active` (true), `currency` (MXN).
- `material`: `acetato | metal | titanio | tr90 | mixto`.
- `shape`: `rectangular | redondo | aviador | cat-eye | cuadrado | ovalado`.
- `gender`: `unisex | hombre | mujer | infantil`.
- Medidas: ancho de mica 20–90, puente 5–40, varilla 80–180, altura opcional 10–90 mm; dos decimales.
- SKU único dentro de `frames`, sin espacios al inicio/final; marca existente; stock entero >= 0.
- Salida: todos los campos anteriores más `id, created_at, updated_at`. Una consulta con join puede incluir `brand`.

### lenses → Lens

- Entrada requerida: `{ brand_id, sku, name, lens_type, material, refractive_index, diameter_mm, price }`.
- Opcionales: `coatings` (array de texto, default []), `stock` (0), `image_url` (null), `is_active` (true), `currency` (MXN).
- `lens_type`: `monofocal | bifocal | progresivo`.
- `material`: `cr39 | policarbonato | trivex | alto_indice | mineral`.
- Índice de refracción 1.49–1.90; diámetro 40–100 mm; SKU único dentro de `lenses`; stock entero >= 0.
- Salida: todos los campos anteriores más `id, created_at, updated_at`.

### patients → Patient

- Entrada requerida (personal): `{ full_name }`.
- Opcionales: `profile_id, birth_date, phone, email`. La fecha de nacimiento no puede ser anterior a 1900-01-01.
- `profile_id` es FK única y nullable a `profiles`: permite pacientes sin cuenta y vincula, como máximo, un paciente por cuenta. Solo personal autorizado registra o vincula pacientes; el cliente no puede apropiarse de un expediente.
- Al borrar una cuenta, el vínculo pasa a null; se conservan el paciente y el historial.
- Salida: `id, profile_id, full_name, birth_date, phone, email, created_at, updated_at`.
- Esta tabla contiene registro/contacto; diagnósticos y antecedentes están en `clinical_records`.

### clinical_records → ClinicalRecord

- Entrada requerida: `{ patient_id, optometrist_id }`. El autor debe tener rol `optometrista`; si crea el registro un optometrista, debe ser él mismo. Admin puede registrar una consulta de un optometrista existente.
- Opcionales: `examined_at` (now), `chief_complaint, medical_history, allergies, diagnosis, notes`.
- Cada fila representa una consulta; el historial se obtiene ordenando por `examined_at desc`.
- Salida: todos los campos anteriores más `id, created_at, updated_at`.
- Autor y paciente de una consulta son inmutables. El autor puede corregir su consulta; Admin puede corregir cualquier consulta. No hay borrado físico mediante la Data API.
- Los optometristas pueden leer el historial clínico de todos los pacientes para continuidad de atención. Un cliente solo puede leer el propio; Recepción no tiene lectura ni escritura clínica.

### prescriptions → Prescription

- Entrada requerida: `{ clinical_record_id, eye, sphere }`.
- Opcionales: `cylinder` (0), `axis` (null), `addition` (0), `pupillary_distance_mm` (null), `visual_acuity` (null).
- `eye`: OD = ojo derecho, OI = ojo izquierdo. Una fila por ojo y consulta.
- Rangos de captura: esfera [-30,30], cilindro [-12,12], adición [0,4]; eje entero [0,180], obligatorio si cilindro != 0. Distancia pupilar **monocular** [20,45] mm.
- Salida: todos los campos anteriores más `id, created_at, updated_at`.
- Lectura heredada de la consulta clínica; escritura para el autor de la consulta o Admin. Consulta y ojo son inmutables; no hay borrado físico por Data API.

### appointments → Appointment

- Entrada requerida: `{ patient_id, optometrist_id, starts_at, ends_at }`.
- Opcionales: `status` (scheduled), `reason` (null). `created_by` se toma de `auth.uid()` y debe coincidir con el usuario autenticado al crear.
- `optometrist_id` debe pertenecer a un perfil con rol optometrista.
- Estados: `scheduled | confirmed | completed | cancelled | no_show`.
- Creación o cambio de horario: inicio futuro; fin posterior al inicio; duración máxima de cuatro horas; ambos extremos deben ser finitos.
- Restricciones EXCLUDE/GiST rechazan traslapes por paciente y por optometrista, incluso entre transacciones concurrentes. Intervalos [inicio, fin): dos citas adyacentes son válidas. Únicamente `cancelled` libera el horario.
- Recepción/Admin: leen y gestionan todas las citas. Optometrista: lee, crea y actualiza las asignadas a sí mismo.
- Cliente: crea únicamente citas propias con estado scheduled; lee las propias. Su única actualización permitida es cancelar una cita propia futura en estado scheduled/confirmed, sin cambiar otros campos. Reprogramación a través del personal.
- Salida: `id, patient_id, optometrist_id, starts_at, ends_at, status, reason, created_by, created_at, updated_at`.
- Identidad, creador y fecha de creación inmutables. No hay DELETE; usar estado cancelled.

## 3. Matriz de acceso RLS

| Recurso | Público (anon) | Cliente | Recepción (vendedor) | Optometrista | Admin |
| --- | --- | --- | --- | --- | --- |
| Perfiles | Ninguno | Leer/editar perfil propio, sin cambiar rol | Igual | Igual | Leer/editar todos, asignar roles |
| Marcas/armazones/micas | Leer activos con marca activa | Igual | Igual | Igual | CRUD, incluidos inactivos |
| Pacientes/contacto | Ninguno | Leer propio | Leer/crear/editar todos | Leer/crear/editar todos | Leer/crear/editar todos |
| Consultas/graduaciones | Ninguno | Leer propias | Ninguno | Leer todas; crear/corregir como autor | Leer/crear/corregir todas |
| Citas | Ninguno | Leer/crear propias; cancelar futuras | Leer/crear/editar todas | Leer/crear/editar asignadas | Leer/crear/editar todas |

No hay DELETE para pacientes, consultas, graduaciones o citas. Las FK restringen la eliminación de perfiles con autoría o citas asignadas. El rol de servicio es privilegiado y se reserva para procesos confiables del servidor.

## 4. Data API de Supabase: consultas y escrituras

Después de aplicar la migración, la URL base es `<SUPABASE_URL>/rest/v1`.
Usar clave publicable y, para datos privados, JWT del usuario. El cliente debe inicializarse con `createClient<Database>(...)`. No usar una clave de servicio en frontend.

| Operación | Entrada HTTP | Salida |
| --- | --- | --- |
| Listar marcas | GET /brands?select=*&order=name.asc | Tables<'brands'>[] según RLS |
| Buscar marca | GET /brands?slug=eq.ray-ban&select=* | Tables<'brands'>[]; [] si no existe/no visible |
| Filtrar armazones | GET /frames?brand_id=eq.<uuid>&price=gte.1000&price=lte.5000&select=*&order=price.asc,id.asc | Tables<'frames'>[] |
| Listar micas | GET /lenses?lens_type=eq.progresivo&select=*&order=price.asc,id.asc | Tables<'lenses'>[] |
| Leer perfil actual | GET /profiles?id=eq.<auth-user-id>&select=* | UserProfile[]; [] si no visible |
| Registrar paciente | POST /patients; JSON TablesInsert<'patients'> | Patient[] con Prefer: return=representation |
| Leer historial | GET /clinical_records?patient_id=eq.<uuid>&select=*&order=examined_at.desc | ClinicalRecord[] según RLS |
| Registrar consulta | POST /clinical_records; JSON TablesInsert<'clinical_records'> | ClinicalRecord[] con Prefer: return=representation |
| Leer graduaciones | GET /prescriptions?clinical_record_id=eq.<uuid>&select=* | Prescription[] según RLS |
| Registrar graduación | POST /prescriptions; JSON TablesInsert<'prescriptions'> | Prescription[] con Prefer: return=representation |
| Agendar | POST /appointments; JSON TablesInsert<'appointments'> | Appointment[] con Prefer: return=representation |
| Agenda por rango | GET /appointments?starts_at=gte.<iso>&starts_at=lt.<iso>&select=*&order=starts_at.asc | Appointment[] según RLS |
| Cancelar cita | PATCH /appointments?id=eq.<uuid>; JSON {"status":"cancelled"} | Appointment[] con Prefer: return=representation |
| Asignar rol (Admin) | PATCH /profiles?id=eq.<uuid>; JSON {"role":"optometrista"} | UserProfile[] con Prefer: return=representation |

Los filtros deben codificarse con el SDK o URLSearchParams. Paginar el catálogo y la agenda con limit/offset (máximo de API local: 1000 filas). En escrituras, enviar Content-Type: application/json; las respuestas sin Prefer: return=representation no incluyen filas.

Las escrituras parciales usan PATCH con filtro por ID y un objeto `TablesUpdate<T>`, sujeto a los permisos de la sección 2. Para editar el perfil, enviar únicamente full_name/avatar_url; role solo con sesión Admin. RLS puede devolver [] para una fila invisible en SELECT o UPDATE; no tratar ese resultado como una actualización exitosa. La capa Next.js traduce una escritura sin fila visible a NOT_FOUND. El directorio de optometristas y la consulta de disponibilidad requieren sesión y se describen en la sección 6.

### Errores SQL/PostgREST esperados

- `42501`: privilegios, rol o política RLS insuficientes.
- `23503`: FK inexistente o borrado de una referencia en uso.
- `23505`: SKU/slug duplicado, cuenta ya vinculada o graduación duplicada por ojo/consulta.
- `23514`: validación de precio/medidas/graduación/horario o asignación inválida de optometrista.
- `23P01`: conflicto de agenda por paciente u optometrista; pedir otro horario.
- La Data API devuelve un objeto de error con `code, message, details, hint`; no mostrar detalles clínicos ni mensajes internos sin filtrar en la interfaz.

## 5. Verificación y aplicación posterior

Pruebas reproducibles sin claves ni conexión remota (PostgreSQL embebido PGlite con btree_gist):

```powershell
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
```

Las pruebas SQL crean una base efímera, simulan las interfaces mínimas de Supabase Auth, aplican las migraciones reales y ejecutan consultas con los roles anon/authenticated. Cubren backfill, alta segura, sincronización de email, aislamiento por paciente, permisos por rol, escritura clínica, cancelaciones, SKU, medidas, graduaciones y restricciones de agenda. También comparan columnas, nullabilidad, campos obligatorios de Insert y relaciones de los tipos TypeScript contra PostgreSQL; verifican que la disponibilidad excluya citas ajenas sin exponerlas y que un error en el segundo ojo revierta la consulta y el primer ojo. Las pruebas de servicios utilizan los query builders reales de supabase-js con transporte HTTP/Auth simulado para verificar filtros, payloads, permisos, rutas y errores. No sustituyen una prueba de integración del servicio Auth ni de la Data API desplegada.

Comprobaciones del proyecto (tras instalar sus dependencias):

```powershell
npx tsc --noEmit --incremental false
npm run build
npm run test:http --prefix supabase/tests
```

`test:http` requiere primero `npm run build`. Levanta el servidor Next.js compilado y un stub local de Supabase para comprobar cookies SSR reales, verificación de usuario, catálogo público, rechazo de escrituras por rol y traducción del conflicto de agenda a HTTP 409. No usa el proyecto remoto ni claves reales.

Para una aplicación futura a un proyecto **vacío y confirmado**, revisar primero sus tablas y el historial de migraciones. No ejecutar sobre el prototipo previo sin reconciliar su esquema. CLI utilizada y fijada: 2.101.0.

```powershell
npx --yes supabase@2.101.0 link --project-ref <PROJECT_REF>
npx --yes supabase@2.101.0 db push --linked --dry-run
# Tras revisar el plan:
npx --yes supabase@2.101.0 db push --linked
```

No se ejecutaron estos comandos remotos en esta entrega. La configuración local expone public/graphql_public; **private no debe añadirse** a los esquemas de la Data API. No hay seed separado: las seis marcas forman parte de la migración.

Referencias de implementación: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [datos de usuario](https://supabase.com/docs/guides/auth/managing-user-data), [privilegios por columna](https://supabase.com/docs/guides/database/postgres/column-level-security).

## 6. Servicios Next.js y Route Handlers

Implementación: `src/services/{catalog,appointments,patients,users}.ts`; rutas: `src/app/api/[...path]/route.ts`. Los servicios reciben un `SupabaseClient<Database>` con sesión del usuario mediante `createCatalogService(db)`, `createAppointmentService(db)`, `createPatientService(db)` o `createUserService(db)`. Los métodos se consumen en servidor; Frontend puede usar los endpoints de esta sección con `fetch`.

### Sesión, configuración y respuestas

- Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (se admite como fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY` del scaffolding). El cliente de cada solicitud usa las cookies de Supabase SSR, verifica al usuario con `auth.getUser()` y consulta su rol en `profiles`. No se usa service_role ni metadata editable para autorización.
- El inicio de sesión del Frontend debe usar el cliente de `@supabase/ssr` para que la sesión se comparta por cookies. Estas rutas no aceptan un JWT arbitrario por body ni crean sesiones de login. Para llamadas `fetch` desde el mismo origen, las cookies se envían por defecto.
- Las rutas escriben cookies renovadas desde el Route Handler y responden `Cache-Control: private, no-store`. No almacenar respuestas clínicas en cachés públicas.
- El scaffolding declara SSR 0.5.x junto con un rango abierto de supabase-js; el adaptador normaliza la diferencia de orden de genéricos entre versiones en un solo punto. Las consultas de servicios permanecen tipadas con `Database`. No se cambian dependencias del Frontend en esta entrega.
- Éxito: `{ data: T }`, HTTP 200, o 201 al crear. Listados paginados: `{ data: { items: T[], total, limit, offset } }`.
- Error: `{ error: { code: ApiErrorCode, message: string } }`, sin SQL, datos clínicos ni credenciales. Códigos: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `SLOT_UNAVAILABLE` (409), `UNAVAILABLE` (503) e `INTERNAL_ERROR` (500).
- Las escrituras JSON requieren `Content-Type: application/json`, máximo 65536 caracteres, sin query string y sin campos desconocidos. Las solicitudes con Origin de otro sitio o `Sec-Fetch-Site: cross-site` son rechazadas. Los DELETE de desactivación/cancelación no requieren body.
- `id`, `created_at`, `updated_at`, `created_by` y campos de joins no son entradas editables en estos servicios. UUID, enums, fechas, rangos y precisión decimal se validan antes de escribir. Las RLS y restricciones SQL siguen siendo la autoridad final.
- La paginación admite `limit` entero 1–100 (default 25) y `offset` 0–100000 (default 0), con orden estable. Los parámetros repetidos son inválidos.

### Catálogo

| Método de createCatalogService(db) | Endpoint | Entrada | T de respuesta |
| --- | --- | --- | --- |
| getBrands() | GET /api/brands | Sin parámetros | Brand[] activas |
| getBrandBySlug(slug) | GET /api/brands/:slug | Slug exacto | Brand |
| listProducts(kind, filters?) | GET /api/catalog/:kind | CatalogFilters por query | Page<CatalogProduct> |
| getProduct(kind, { id }) | GET /api/catalog/:kind/:id | UUID exacto | CatalogProduct |
| getProduct(kind, { sku }) | GET /api/catalog/:kind/sku/:sku | SKU exacto codificado como segmento URL | CatalogProduct |
| createProduct(kind, input) | POST /api/catalog/:kind | FrameInput o LensInput | Product |
| updateProduct(kind, id, input) | PATCH /api/catalog/:kind/:id | Partial<FrameInput> o Partial<LensInput>; al menos un campo | Product |
| deactivateProduct(kind, id) | DELETE /api/catalog/:kind/:id | Sin body | Product con is_active=false |

- `kind`: exclusivamente `frames` o `lenses`. Material, medidas y campos requeridos conservan los valores de la sección 2. Precio y medidas aceptan máximo dos decimales; stock es entero no negativo.
- Filtros: `brand_id`, `category` (categoría de **la marca**, no tipo de mica), `search` (SKU **o** nombre/modelo), `min_price`, `max_price`, `include_inactive`, `limit`, `offset`.
- `search`: 1–80 caracteres; letras, números, espacios, guion, diagonal y guion bajo. Se busca por coincidencia parcial sin distinguir mayúsculas; el guion bajo se trata literalmente. Se rechazan expresiones de filtro PostgREST en el texto.
- Catálogo público: productos activos de marcas activas. `include_inactive=true` requiere Admin. Un detalle no visible devuelve 404. Admin puede consultar detalles de inactivos.
- Crear, actualizar precio/stock u otros campos y desactivar requieren Admin tanto en servicio como por RLS. DELETE es baja lógica; no borra físicamente productos.

Ejemplo: `GET /api/catalog/frames?category=lujo&search=Ray-Ban&min_price=1000&max_price=5000&limit=20`.

### Citas y disponibilidad

| Método de createAppointmentService(db) | Endpoint | Entrada | T de respuesta |
| --- | --- | --- | --- |
| listOptometrists() | GET /api/optometrists | Sin parámetros | OptometristSummary[]: solo id/full_name |
| getAvailableSlots(input) | GET /api/appointments/availability | date=YYYY-MM-DD, optometrist_id; duration_minutes opcional (30) | AvailableSlot[] |
| listAppointments(filters?) | GET /api/appointments | patient_id?, optometrist_id?, from?, to?, limit?, offset? | Page<Appointment> según RLS |
| createAppointment(input) | POST /api/appointments | AppointmentInput: patient_id, optometrist_id, starts_at, ends_at, reason? | Appointment |
| rescheduleAppointment(id, input) | PATCH /api/appointments/:id | RescheduleInput: starts_at, ends_at; optometrist_id opcional | Appointment |
| cancelAppointment(id) | DELETE /api/appointments/:id | Sin body | Appointment con status=cancelled |

- Todos requieren sesión. `from`/`to` filtran el inicio en intervalo [from,to); fechas ISO con zona, no fechas sin offset.
- Disponibilidad: sugerencias entre **09:00 y 18:00, todos los días**, zona `America/Mexico_City`, con inicios cada 15 minutos. Duración 15–240, múltiplo de 15. La fecha debe ser hoy o estar dentro de los próximos 90 días. No hay calendario de días festivos, descansos ni horario individual en este esquema. Esta ventana limita las sugerencias; la creación de citas conserva las reglas de la sección 2, sin imponer esa ventana como horario del negocio.
- La consulta SQL excluye toda ocupación del optometrista, incluso citas invisibles por RLS para el cliente, y devuelve únicamente `starts_at, ends_at`. No comprueba conflictos del paciente específico ni aparta horarios; el INSERT/UPDATE verifica ambos traslapes mediante EXCLUDE. La propia cita aparece ocupada al consultar disponibilidad para reprogramarla.
- Reprogramar requiere Admin, Recepción u optometrista asignado; solo sobre scheduled/confirmed. Clientes cancelan y solicitan al personal la reprogramación. Las restricciones SQL validan propiedad y asignación.
- Cancelar solo actualiza scheduled/confirmed; un cliente además solo puede cancelar las propias futuras. Una fila inexistente, invisible o que ya no admite esa operación devuelve 404, nunca éxito vacío. Las restricciones por rol pueden producir 403.
- Si otra solicitud ocupa el horario entre consulta y escritura, la base devuelve `23P01`; el endpoint responde HTTP 409, código `SLOT_UNAVAILABLE`, mensaje: “El horario ya está ocupado para el paciente o el optometrista. Elige otro horario.”

### Pacientes y expediente clínico

| Método de createPatientService(db) | Endpoint | Entrada | T de respuesta |
| --- | --- | --- | --- |
| listPatients(filters?) | GET /api/patients | search? sobre nombre, limit?, offset? | Page<Patient> |
| registerPatient(input) | POST /api/patients | PatientInput: full_name; profile_id?, birth_date?, phone?, email? | Patient |
| getHistory(patientId, pagination?) | GET /api/patients/:id/history | limit?, offset? | ClinicalHistory |
| getMyHistory(pagination?) | GET /api/me/history | limit?, offset? | ClinicalHistory del cliente autenticado |
| createClinicalExam(input) | POST /api/clinical-exams | ClinicalExamInput: { record: ClinicalRecordInput, prescriptions: EyePrescriptionInput[] } | ClinicalExam |

- Listado y registro de pacientes: Admin, Optometrista o Recepción, conforme al contrato previo. Correo válido si se proporciona; nacimiento entre 1900-01-01 y hoy. Para vincular una cuenta, el personal envía el UUID en profile_id.
- Historial: Admin/Optometrista, o el propio cliente mediante RLS. Recepción no puede leerlo. `ClinicalHistory` contiene `patient`, `records` con sus `prescriptions`, `total`, `limit`, `offset`; orden por examined_at descendente. La cuenta sin paciente vinculado devuelve 404.
- Crear consulta: Admin/Optometrista. En `record`, patient_id y optometrist_id son obligatorios; los campos clínicos restantes son los de la sección 2. Si el caller es optometrista, RLS obliga a que sea el autor. Admin puede indicar un optometrista existente.
- `prescriptions` contiene uno o dos ojos únicos, OD/OI. Cada objeto requiere eye/sphere; admite cylinder, axis, addition, pupillary_distance_mm (monocular) y visual_acuity. Eje obligatorio si cilindro != 0; se aplican los rangos SQL y máximo dos decimales.
- Se ejecuta una única RPC transaccional: si falla un ojo, se revierten la consulta y todos los ojos. No se escribe parcialmente el expediente. El servicio no crea un historial sin al menos un ojo. No hay escritura clínica para cliente o Recepción.

Ejemplo de cuerpo para registrar ambos ojos:

```json
{
  "record": { "patient_id": "<UUID paciente>", "optometrist_id": "<UUID optometrista>", "notes": "Seguimiento" },
  "prescriptions": [
    { "eye": "OD", "sphere": -1.25, "cylinder": -0.5, "axis": 90, "addition": 0, "pupillary_distance_mm": 31 },
    { "eye": "OI", "sphere": -1, "cylinder": 0, "addition": 0, "pupillary_distance_mm": 31 }
  ]
}
```

### Usuarios y roles

| Método de createUserService(db) | Endpoint | Entrada | T de respuesta |
| --- | --- | --- | --- |
| getCurrentUserProfile() | GET /api/me/profile | Sesión, sin parámetros | UserProfile |
| listProfiles(pagination?) | GET /api/users | limit?, offset? | Page<UserProfile> |
| updateRole(id, input) | PATCH /api/users/:id/role | { role: UserRole } | UserProfile |

Listar perfiles y cambiar roles requiere Admin. Solo se acepta role, con valor admin/optometrista/vendedor/cliente; no se editan email, ID ni otros campos en ese endpoint. RLS y el trigger de perfiles vuelven a validar el permiso aunque cambie el rol entre comprobación y escritura. El perfil propio se obtiene para cualquier sesión válida; una sesión ausente devuelve 401.

### RPC agregadas por la segunda migración

| RPC pública (SECURITY INVOKER) | Args de Database | Retorno |
| --- | --- | --- |
| get_available_slots | { p_date: string, p_optometrist_id: UUID, p_duration_minutes?: number } | AvailableSlot[] |
| list_optometrists | {} | OptometristSummary[] |
| create_clinical_exam | { p_record: Json, p_prescriptions: Json } | Json con forma ClinicalExam |

EXECUTE restringido a authenticated; anon no puede llamarlas. Las dos primeras delegan en helpers SECURITY DEFINER del esquema private con comprobación de identidad/perfil y salida mínima. create_clinical_exam usa los permisos del usuario y mantiene las RLS existentes. No cambia ninguna tabla ni amplía sus políticas de lectura.

## Pendientes para Backend

- [x] Consultas de catálogo: getBrands/getBrandBySlug y listProducts('frames', filtros), expuestas también por Route Handlers. No se exporta una Server Action llamada getFrames.
- [x] Cliente SSR y getCurrentUserProfile vía GET /api/me/profile. El formulario de login y su sesión compartida por cookies deben integrarse desde Frontend.
- [x] Definir políticas RLS según admin, optometrista, vendedor y cliente (incluidas en migración; pendientes de despliegue).
- [x] Directorio de optometristas con campos mínimos y horarios disponibles; aplicar la segunda migración para habilitar las RPC.
- [ ] Integración y pruebas contra Supabase Auth/Data API una vez aprobado el proyecto de destino.
