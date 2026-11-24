# OptiZap Móvil

Aplicación Flutter Android para registrar entradas y salidas de armazones
escaneando su código. No es un WebView. El código leído se busca en
`public.frames.sku`; la operación atómica `record_frame_movement` actualiza
existencias y escribe el historial en `public.stock_movements`.

## Requisitos

- Flutter 3.47.2 o compatible, Dart 3.13, Android SDK 35/36 y Java 17.
- Proyecto Supabase con las migraciones de `../supabase/migrations`.
- Cuenta de Supabase Auth con rol `admin` o `vendedor` en `profiles`.
- Teléfono Android con cámara, o entrada manual del SKU.

## Ejecutar

Crear `config/local.json` (excluido de Git):

```json
{
  "SUPABASE_URL": "https://TU_PROYECTO.supabase.co",
  "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_..."
}
```

La clave es pública. Nunca incluir una clave secreta o `service_role`.

```sh
flutter pub get
flutter analyze
flutter test
flutter run --dart-define-from-file=config/local.json
```

## APK firmado

Generar una clave propia de distribución y guardar su copia de respaldo fuera
del repositorio. Crear `android/key.properties` con:

```properties
storePassword=CONTRASEÑA_PRIVADA
keyPassword=CONTRASEÑA_PRIVADA
keyAlias=optizap
storeFile=../optizap-upload.jks
```

Crear `android/optizap-upload.jks` con `keytool`. Los dos archivos están
excluidos de Git; perderlos impide firmar una actualización con la misma
identidad. Luego ejecutar:

```sh
flutter build apk --release --dart-define-from-file=config/local.json
```

Resultado: `build/app/outputs/flutter-apk/app-release.apk`.

## Demostración

1. Iniciar sesión con una cuenta autorizada.
2. Escanear un código de barras cuyo contenido sea `OZ-DEMO-001` o escribir
   ese SKU. La cámara solo se solicita al abrir el escáner.
3. Registrar una entrada o salida y observar el nuevo saldo e historial.
4. Abrir `/inventario` en la web, usar la misma cuenta y pulsar
   «Actualizar» para comprobar el saldo compartido.
5. Desconectar la red e intentar buscar o guardar: debe aparecer un error,
   nunca una confirmación falsa. Si el servidor procesó un intento sin que
   llegara la respuesta, «Confirmar movimiento» reutiliza el identificador
   de solicitud para impedir duplicados.

El escáner reconoce el valor del código, no fotografía ni almacena imágenes.
La versión MVP requiere conexión para confirmar movimientos.
