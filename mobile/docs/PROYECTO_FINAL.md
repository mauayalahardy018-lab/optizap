# Proyecto final: OptiZap Móvil

**Desarrollo de aplicaciones móviles · Modalidad B · Entrega técnica**

**Equipo:** Mauricio Ayala Hardy; Leonardo Abel Celis Fernandez; Erick Alonso
Morales Barrios; Erik Daniel Peniche Gomez.

**Autorización docente:** pendiente de constancia. Esta propuesta está lista
para presentar; no atribuye una aprobación no recibida. El docente define
la fecha de entrega y exposición.

## 1. Propuesta, usuario y alcance

**Problema.** En una óptica con una sucursal y 3 o 4 trabajadores, el personal
necesita consultar y ajustar existencias de armazones desde el mostrador o
almacén. Volver a la computadora y transcribir el SKU aumenta pasos y errores.
El cliente ya solicitó control por pieza y código de barras. La información
proviene del levantamiento entregado por el cliente; falta observar una jornada
real y validar tiempos de operación.

**Usuario objetivo.** Dueño o vendedor autorizado que maneja armazones
físicamente. El optometrista y clientes no modifican existencias.

**Solución.** App Flutter nativa que escanea la etiqueta con la cámara, busca
el armazón, muestra saldo y registra entrada o salida con historial. La web
consulta administrativamente el mismo inventario.

**Beneficio móvil.** Sin teléfono se pierde la captura del código directamente
frente a la pieza y el registro del movimiento en el lugar donde ocurre. El
escáner y el flujo breve son la diferencia comprobable frente a la web. No
se usa WebView.

**Prioridades:** inicio de sesión; escaneo o entrada manual; consulta de
armazón y saldo; entrada/salida validada; historial; consulta web compartida.

**MVP:** solo armazones. Quedan fuera recetas, pacientes, facturación, pagos,
laboratorios, Excel y movimientos sin conexión. No se usan datos clínicos.
El SKU `OZ-DEMO-001` es ficticio.

**Riesgos:** pérdida de red, cámara o etiqueta ilegible, SDK Android incompleto,
cuentas sin rol, falta de aprobación y evidencia de equipo incompleta.

### Responsabilidades iniciales propuestas

| Integrante | Responsabilidad propuesta |
|---|---|
| Mauricio Ayala Hardy | Coordinación, análisis y validación con cliente |
| Leonardo Abel Celis Fernandez | Interfaz y navegación Flutter |
| Erick Alonso Morales Barrios | Supabase, modelo de datos y permisos |
| Erik Daniel Peniche Gomez | Pruebas Android, documentación y exposición |

Esta asignación no acredita contribuciones. Cada integrante debe realizar y
explicar cambios verificables en su propia rama o Pull Request.

## 2. Comparación web y móvil

| Web Next.js | Flutter Android | Datos compartidos |
|---|---|---|
Consulta administrativa del inventario e historial | Escanea etiqueta y registra movimiento en mostrador | Supabase Auth, `profiles`, `brands`, `frames`, `stock_movements` |
Pantalla amplia para revisión | Pantalla breve para operación en movimiento | RLS y función transaccional |

```text
Óptica → Web /inventario ─┐
                         ├→ Supabase Auth + PostgreSQL → frames, stock_movements
Personal → Flutter móvil ─┘
              cámara → SKU → consulta → entrada/salida → confirmación
```

La PWA publicada anteriormente usa una tabla JSON de demostración distinta.
Esta entrega utiliza el repositorio Next.js y el esquema normalizado; la PWA
anterior no refleja automáticamente estos movimientos.

## 3. Historias de usuario y criterios de aceptación

| ID | Historia | Condición comprobable |
|---|---|---|
| HU-01 | Como vendedor quiero iniciar sesión para acceder al inventario. | Cuenta válida entra; una inválida muestra error. |
| HU-02 | Como vendedor quiero escanear una pieza para encontrarla sin teclear. | La cámara lee el SKU y muestra ese armazón. |
| HU-03 | Como vendedor quiero registrar entrada o salida para mantener el saldo. | Operación válida cambia stock y crea un evento único. |
| HU-04 | Como dueño quiero consultar movimientos. | Web y móvil muestran el saldo confirmado. |
| HU-05 | Como responsable quiero impedir salidas superiores al stock. | Interfaz y base rechazan sin cambiar saldo. |
| HU-06 | Como administrador quiero limitar operaciones al personal. | Usuario sin rol autorizado recibe rechazo de la base. |
| HU-07 | Como vendedor quiero saber si falló la red. | No aparece éxito falso; reintentar no duplica. |

**Funcionales:** RF-01 autenticación; RF-02 código de barras; RF-03 búsqueda
SKU; RF-04 saldo; RF-05 movimiento; RF-06 historial; RF-07 consulta web.

**No funcionales:** RNF-01 RLS y validación servidor; RNF-02 transacción e
idempotencia; RNF-03 mensajes legibles; RNF-04 interfaz telefónica; RNF-05
secretos fuera de APK/Git; RNF-06 APK firmado; RNF-07 fallo de red controlado.

## 4. Experiencia móvil

**Navegación:** Login → Inventario → Escáner → Inventario con pieza seleccionada
→ Confirmación e historial. «Salir» regresa a login.

```text
┌ Inicio de sesión ────────┐    ┌ Inventario ─────────────┐
│ OptiZap Móvil            │    │ SKU [____________]       │
│ Correo                   │ →  │ [Escanear] [Buscar]      │
│ Contraseña               │    │ Pieza · saldo            │
│ [Entrar]                 │    │ Entrada | Salida         │
└──────────────────────────┘    │ Cantidad · motivo        │
┌ Cámara ─────────────────┐    │ [Confirmar movimiento]   │
│ Enfocar código de barra │ ↗  │ Historial reciente       │
└─────────────────────────┘    └──────────────────────────┘
```

**Identidad:** azul marino `#092143`, turquesa `#087f86`, fondo
`#f3f7fb` y tipografía Material/Roboto. Hay botones amplios, etiquetas
visibles y entrada manual si no hay cámara. La cámara solo lee la etiqueta;
no se guardan imágenes ni audio.

**Estados:** carga, historial vacío, éxito tras respuesta del RPC y errores
de login, SKU desconocido, cantidad inválida, stock insuficiente y falta de
red. Sin conexión no se confirma ningún cambio.

## 5. Arquitectura, datos y seguridad

- Flutter: pantallas en `lib/main.dart`; modelo, validación y repositorio en
  `lib/inventory.dart`.
- Supabase Auth: correo y contraseña. La clave publishable es pública.
  `service_role` y la clave de firma no están en el APK ni en Git.
- PostgreSQL: `profiles` conserva el rol; `brands` y `frames` contienen
  catálogo y saldo; `stock_movements` registra actor, delta, saldo anterior
  y posterior, motivo, fecha e identificador de solicitud.
- RLS: lectura del historial solo para admin/vendedor; escritura directa
  revocada. El RPC público es `SECURITY INVOKER`; la implementación
  privilegiada está en `private` y verifica el rol real.
- La transacción bloquea la fila, valida el stock y actualiza saldo e
  historial. El UUID de solicitud evita duplicados por reintentos.
- Web y móvil usan las mismas tablas. La web refresca a petición; no hay
  sincronización automática en tiempo real.

**Conectividad.** La búsqueda y los movimientos necesitan internet. Si se
pierde la respuesta, la pantalla conserva el UUID del intento; repetirlo
devuelve el resultado previo. Al cambiar cantidad, tipo o motivo se genera
una nueva solicitud. Conviene revisar el historial si la red fue incierta.

## 6. Construcción y colaboración

1. Base Flutter, identidad y navegación.
2. Esquema Supabase, RLS y servicio de inventario.
3. Escaneo, búsqueda y movimiento.
4. Consulta web y datos compartidos.
5. Validaciones, firma, APK y evidencia Android.

Rama de trabajo: `codex/flutter-mobile-mvp`. No se integra directamente
a `main`. Para cumplir la rúbrica de colaboración, los cuatro integrantes
deben crear cambios identificables, pedir revisión y registrar acuerdos. No
se atribuyen a otros los commits de esta sesión.

## 7. Matriz de pruebas e incidencias

| Caso | Resultado esperado | Evidencia actual |
|---|---|---|
| Dart y validación | Sin errores; cantidad inválida rechazada | `flutter analyze` y `flutter test` ejecutados |
| Admin autorizado | Saldo 5→6 y evento | Verificado en Supabase |
| Reintento mismo UUID | Saldo permanece en 6 | Verificado en Supabase |
| Salida 999 con saldo 6 | Rechazo sin cambio | Verificado en Supabase |
| Usuario sin perfil | Error `42501 Inventory staff required` | Verificado en Supabase |
| Acceso web | La vista de inventario abre sin errores | Verificado en navegador. Falta comprobar el saldo con una sesión |
| Firma de distribución | APK firmado para `mx.optizap.mobile` | Firma v2 e identidad verificadas con Android SDK |
| Instalación y cámara | APK abre y lee etiqueta | Pendiente en Android. El emulador local carece de imagen del sistema |
| Sin red | Error sin confirmación falsa | Pendiente de teléfono físico |

**Defecto corregido:** inicialmente `NULL NOT IN` permitió avanzar a una
clave foránea antes de rechazar un usuario sin perfil. La condición ahora
trata la ausencia de rol como denegación; se repitió la prueba y devolvió
`42501`.

## 8. Entrega y exposición

Entregar repositorio con `mobile/`, migraciones, contrato, README y este
documento; APK firmado; evidencia de instalación, escaneo y flujo; propuesta
aprobada por docente; y bitácora/PRs individuales. El código no sustituye la
aprobación ni las participaciones reales.

**Guion:** problema → diferencia web/móvil → login → escaneo de
`OZ-DEMO-001` → entrada/salida → saldo e historial → vista web → intento
inválido → permiso/red → arquitectura, seguridad y decisiones. Cada integrante
presenta una parte implementada y una decisión técnica.
