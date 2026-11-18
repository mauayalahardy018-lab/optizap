# Configuración de Supabase SSR para Optizap

Esta rama (`feat/auth-ssr`) prepara la autenticación real sin modificar el proyecto Supabase remoto. Parte de `feat/integration`; las vistas conservan su conexión o sus mocks según el trabajo de Frontend. Los endpoints privados verifican la sesión y las RLS independientemente del selector de rol de demostración.

## 1. Requisitos y variables de entorno

Usar Node.js **22 o superior** (validado con Node 24), npm y un proyecto Supabase activo. Las versiones de autenticación están fijadas en `package.json` y `package-lock.json`: `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.119.0.

En la raíz del repositorio crear **`.env.local`**, que está excluido de Git:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<CLAVE_PUBLICABLE_DEL_PROYECTO>
SITE_URL=http://localhost:3000
```

Obtener URL y clave publicable desde el panel del proyecto Supabase, en Connect/API Keys. `PROJECT_REF` y los textos entre `<...>` son marcadores que deben sustituirse. `.env.example` contiene la misma estructura sin credenciales.

| Variable | Uso |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL de la API del proyecto para navegador, servidor y middleware |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clave publicable; la autorización de datos sigue dependiendo del JWT y RLS |
| SITE_URL | Origen canónico de Optizap para confirmaciones y redirects; sin ruta, query ni fragmento |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Fallback opcional para proyectos con clave anon legacy; no hace falta si se usa PUBLISHABLE_KEY |

Si se definen ambas claves, PUBLISHABLE_KEY tiene prioridad. No usar claves `service_role`, `sb_secret_...`, secretos JWT ni contraseñas de PostgreSQL en estas variables. La app no necesita claves privilegiadas para login, registro o consultas del usuario.

En producción usar, por ejemplo, `SITE_URL=https://optizap.ejemplo.com`. Configurar las mismas variables en el hosting **antes del build**: Next.js incorpora los valores NEXT_PUBLIC al bundle del navegador. Reiniciar `npm run dev` después de cambiar `.env.local`; en producción volver a compilar al cambiar esas variables.

Instalar las versiones registradas en el lockfile:

```powershell
npm ci
npm ci --prefix supabase/tests
```

## 2. Migraciones SQL y seed: orden exacto

El esquema inicial está diseñado para un proyecto Supabase nuevo. Si el destino ya contiene las tablas del prototipo, revisar y reconciliar primero su esquema y su historial; no aplicar a ciegas el CREATE inicial. Mantener las migraciones ya aplicadas, sin volver a ejecutarlas manualmente.

Orden de una instalación nueva:

1. `supabase/migrations/20261117230647_optizap_initial_schema.sql`: tablas, enums, índices, RLS, trigger de perfiles y las seis marcas iniciales.
2. `supabase/migrations/20261117233231_service_rpcs.sql`: disponibilidad, directorio mínimo y alta clínica transaccional.
3. `supabase/migrations/20261118000151_frontend_integration.sql`: segmento óptico/solar en armazones.
4. `supabase/seed.sql`: seed idempotente de Ray-Ban, Oakley, Persol, Tom Ford, Essilor y ZEISS. Completa marcas faltantes y no sobrescribe las existentes.

No hay una cuarta migración para Auth: Supabase ya proporciona `auth.users` y la primera migración instala los triggers necesarios. El seed no crea usuarios, contraseñas, pacientes, productos de demostración ni precios ficticios.

### Aplicación con CLI (recomendada)

Ejecutar desde la raíz del repositorio. Se fija CLI 2.101.0 para reproducir los comandos de esta entrega:

```powershell
npx --yes supabase@2.101.0 login
npx --yes supabase@2.101.0 link --project-ref <PROJECT_REF>
npx --yes supabase@2.101.0 migration list --linked
npx --yes supabase@2.101.0 db push --linked --include-seed --dry-run
```

Revisar que el proyecto vinculado sea el destino correcto y que el plan contenga solo las migraciones pendientes. Después aplicar:

```powershell
npx --yes supabase@2.101.0 db push --linked --include-seed
npx --yes supabase@2.101.0 migration list --linked
```

La CLI ordena las migraciones por su prefijo y ejecuta el seed al final. Las marcas ya incluidas en la primera migración no se duplican porque el seed usa `ON CONFLICT (slug) DO NOTHING`.

Como alternativa, el SQL Editor permite ejecutar los tres archivos en el orden anterior y luego `seed.sql`, con un operador de base autorizado. Esa vía no registra automáticamente el historial de la CLI: no mezclar luego un `db push` sin reconciliarlo. No ejecutar el seed desde un cliente público.

## 3. Configurar Supabase Auth y correo

En el panel del proyecto:

1. Habilitar el proveedor **Email**, el registro de usuarios y **Confirm email**. Usar una longitud mínima de contraseña de 8 caracteres; la API de registro valida entre 8 y 128 sin recortar la contraseña.
2. En **Authentication → URL Configuration**, poner Site URL exactamente igual a SITE_URL. Para desarrollo con esta configuración: `http://localhost:3000`.
3. Añadir a Redirect URLs: `http://localhost:3000/api/auth/callback`. En producción añadir la URL exacta equivalente, por ejemplo `https://optizap.ejemplo.com/api/auth/callback`. Mantener el mismo host durante el registro: localhost y 127.0.0.1 tienen cookies distintas.
4. Configurar el envío de correo del proyecto/SMTP para los destinatarios que se usarán. La configuración TOML local no cambia las opciones del proyecto hospedado.
5. En la plantilla **Confirm signup**, usar el contenido de `supabase/templates/confirmation.html`, o este enlace equivalente:

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirmar mi correo</a>
```

El enlace con token_hash funciona sin depender de la cookie PKCE del navegador que inició el registro. El endpoint verifica el token con Supabase, escribe las cookies de sesión y redirige a `/`. Se admite `next=/citas` u otra ruta relativa del mismo sitio; los destinos externos se rechazan.

También se incluye `/api/auth/callback` para enlaces que devuelven un `code` PKCE, como la plantilla predeterminada basada en `{{ .ConfirmationURL }}`. En ese flujo el usuario debe abrir el enlace en el mismo navegador del registro, porque necesita la cookie del verificador. El SDK guarda y consume ese verificador automáticamente.

El esquema `private` no debe exponerse en la Data API. Las tablas públicas ya tienen grants y RLS en las migraciones. Registrar una cuenta no otorga acceso clínico ni administrativo.

## 4. Registro, login y logout desde Frontend

Todos los POST son del mismo origen y responden con el envelope de `API_CONTRACT.md`; no devuelven access_token ni refresh_token en JSON.

| Endpoint | Cuerpo | Respuesta |
| --- | --- | --- |
| POST /api/auth/register | { email, password, full_name } | 202 con { data: { user: null, requires_email_confirmation: true } }; 201 con usuario si el proyecto desactiva confirmación |
| POST /api/auth/login | { email, password } | 200 con { data: { user: { id, email } } } y cookies SSR |
| POST /api/auth/logout | Sin cuerpo o {} | 200 con { data: { signed_out: true } }; cierra la sesión actual, no todas las demás |
| GET /api/auth/confirm | token_hash, type=email, next opcional | 303 al destino local, con cookies tras verificar el token |
| GET /api/auth/callback | code, next opcional | 303 tras intercambio PKCE; necesita el verificador del registro |
| GET /api/me/profile | Sesión por cookies | Perfil y rol reales de la base, o 401 sin sesión |

Ejemplo de registro desde el navegador:

```ts
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, full_name }),
});
const result = await response.json();
```

Tras login/confirmación, consultar `/api/me/profile`, actualizar el estado real del provider y refrescar la vista. No asignar el rol desde `user_metadata`, el formulario o el selector de demostración. Si el registro requiere correo, mostrar el aviso de confirmación; no tratarlo como una sesión ya iniciada. La respuesta de una cuenta ya registrada se mantiene genérica.

Cada INSERT en `auth.users` dispara `private.sync_auth_profile()`, que crea `profiles.role='cliente'`. El endpoint rechaza campos como role, id y emailRedirectTo. El trigger también fuerza cliente aunque el registro se haga directamente contra Supabase enviando metadata con otro rol.

Primer Admin: registrar y confirmar una cuenta real; luego un operador autorizado obtiene su UUID y ejecuta en SQL Editor:

```sql
select id, email, role from public.profiles where email = 'correo-del-administrador@ejemplo.com';
update public.profiles set role = 'admin' where id = '<UUID de la cuenta registrada>';
```

Sustituir ambos marcadores. Los cambios posteriores de roles pueden hacerse con sesión Admin en `PATCH /api/users/:id/role`. El alta de pacientes y su vínculo con la cuenta siguen correspondiendo al personal; el signup no crea un expediente clínico automáticamente.

## 5. Qué cliente usar

| Contexto | Función | Archivo |
| --- | --- | --- |
| Componente cliente/navegador | createBrowserSupabaseClient() | src/lib/supabase/client.ts |
| Server Component | await createServerSupabaseClient() | src/lib/supabase/server.ts |
| Route Handler / Server Action | await createRequestClient() | src/lib/supabase/server.ts |
| Middleware de Next.js 15 | updateSession(request) | src/lib/supabase/middleware.ts, invocado desde src/middleware.ts |

El cliente del navegador usa el singleton de @supabase/ssr y comparte cookies. Los clientes de servidor se crean por solicitud y leen su configuración en ejecución; los valores del navegador se incorporan al build. Los Server Components solo leen: las operaciones que modifican sesión se hacen en Route Handlers/acciones, donde Next permite escribir cookies.

El middleware verifica con `auth.getUser()`, renueva el token cuando corresponde y copia las cookies renovadas a la solicitud que continuará hacia el servidor y a la respuesta del navegador. Preserva los headers de no caché entregados por SSR. No usa el objeto de usuario no verificado de `getSession()` para autorizar. No agrega redirects de páginas a un formulario de login inexistente: las vistas pueden seguir siendo públicas/de demostración, y los servicios privados exigen sesión y rol.

Si faltan URL o clave, las pantallas públicas pueden renderizar; los endpoints de datos/autenticación devuelven 503 de configuración. SITE_URL es obligatorio al registrar y al completar confirmación/callback.

## 6. Desarrollo local y verificación

Para usar Supabase local se requiere Docker. Con `npx --yes supabase@2.101.0 start` se puede iniciar la pila local; usar su URL y clave publicable/anon en `.env.local`. `supabase/config.toml` configura sitio localhost:3000, confirmación habilitada, contraseña mínima 8 y plantilla local de correo; el visor local de emails usa el puerto 54324. Las migraciones y el seed se aplican al iniciar una base local nueva. Esta configuración local no despliega la base hospedada.

Para probar la app:

```powershell
npm test --prefix supabase/tests
npx tsc --noEmit --incremental false
npm run build
npm run test:http --prefix supabase/tests
```

Las pruebas SQL usan PostgreSQL embebido y cubren RLS, el trigger cliente y el seed repetible. Las de Auth usan el SDK real con transporte simulado. Las HTTP levantan Next compilado y un stub local de Supabase: comprueban login, logout, confirmación, PKCE y renovación de token una sola vez en la solicitud, conservando cookies y no caché. No necesitan credenciales reales y no modifican el proyecto remoto.

Para comprobar el proyecto real después de configurarlo: registrar una cuenta, confirmar el email, consultar el perfil cliente, cerrar sesión y comprobar 401 en `/api/me/profile`, y volver a iniciar sesión. El formulario de Frontend debe mostrar errores de credenciales (401), correo pendiente (403), validación (400), límite de intentos (429) y servicio/configuración (503) usando los mensajes sanitizados de la API.

Referencias oficiales: [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth por contraseña](https://supabase.com/docs/guides/auth/passwords), [datos de usuario](https://supabase.com/docs/guides/auth/managing-user-data).
