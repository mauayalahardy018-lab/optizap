# API_CONTRACT.md - Contrato de Datos y Server Actions (Optizap)

Contrato compartido entre Backend (`feat/backend`) y Frontend (`feat/frontend`).
Fuente de tipos: `src/types/database.ts`. Migración inicial:
`supabase/migrations/20261117230647_optizap_initial_schema.sql`.

## 1. Estado e invariantes

- La migración está preparada para una base Supabase nueva. No se ha aplicado al proyecto remoto; esta entrega solo publica archivos en GitHub.
- No se crean Server Actions, Route Handlers ni RPC públicos en este módulo. Los endpoints de tablas descritos abajo son la Data API de Supabase y existirán al aplicar la migración con la Data API habilitada.
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

Las escrituras parciales usan PATCH con filtro por ID y un objeto `TablesUpdate<T>`, sujeto a los permisos de la sección 2. Para editar el perfil, enviar únicamente full_name/avatar_url; role solo con sesión Admin. RLS puede devolver [] para una fila invisible en SELECT o UPDATE; no tratar ese resultado como una actualización exitosa. No se implementa en este módulo un directorio público de optometristas ni una API de horarios libres.

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

Las pruebas crean una base efímera, simulan las interfaces mínimas de Supabase Auth, aplican la migración real y ejecutan consultas con los roles anon/authenticated. Cubren backfill, alta segura, sincronización de email, aislamiento por paciente, permisos por rol, escritura clínica, cancelaciones, SKU, medidas, graduaciones y restricciones de agenda. También comparan columnas, nullabilidad, campos obligatorios de Insert y relaciones de los tipos TypeScript contra los metadatos reales de PostgreSQL. No sustituyen una prueba de integración del servicio Auth ni de la Data API desplegada.

Comprobaciones del proyecto (tras instalar sus dependencias):

```powershell
npx tsc --noEmit --incremental false
npm run build
```

Para una aplicación futura a un proyecto **vacío y confirmado**, revisar primero sus tablas y el historial de migraciones. No ejecutar sobre el prototipo previo sin reconciliar su esquema. CLI utilizada y fijada: 2.101.0.

```powershell
npx --yes supabase@2.101.0 link --project-ref <PROJECT_REF>
npx --yes supabase@2.101.0 db push --linked --dry-run
# Tras revisar el plan:
npx --yes supabase@2.101.0 db push --linked
```

No se ejecutaron estos comandos remotos en esta entrega. La configuración local expone public/graphql_public; **private no debe añadirse** a los esquemas de la Data API. No hay seed separado: las seis marcas forman parte de la migración.

Referencias de implementación: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [datos de usuario](https://supabase.com/docs/guides/auth/managing-user-data), [privilegios por columna](https://supabase.com/docs/guides/database/postgres/column-level-security).

## 6. Server Actions / Route Handlers

Todavía no implementados. Esta entrega define esquema, RLS, tipos y contrato de tablas.

## Pendientes para Backend

- [ ] Implementar Server Actions para obtener y filtrar el catálogo de marcas (`getBrands`, `getBrandBySlug`) y armazones (`getFrames`).
- [ ] Implementar gestión de sesión y obtención del rol del usuario actual (`getCurrentUserProfile`).
- [x] Definir políticas RLS según admin, optometrista, vendedor y cliente (incluidas en migración; pendientes de despliegue).
- [ ] Directorio de optometristas con campos mínimos y consulta de horarios disponibles para el flujo de autoagendamiento.
- [ ] Integración y pruebas contra Supabase Auth/Data API una vez aprobado el proyecto de destino.
