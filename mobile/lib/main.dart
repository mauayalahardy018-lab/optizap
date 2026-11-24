import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'inventory.dart';

const projectUrl = String.fromEnvironment('SUPABASE_URL');
const publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (projectUrl.isNotEmpty && publishableKey.isNotEmpty) {
    await Supabase.initialize(url: projectUrl, publishableKey: publishableKey);
  }
  runApp(const OptiZapApp());
}

class OptiZapApp extends StatelessWidget {
  const OptiZapApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'OptiZap Móvil',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff087f86)),
      scaffoldBackgroundColor: const Color(0xfff3f7fb),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xff092143),
        foregroundColor: Colors.white,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    home: projectUrl.isEmpty || publishableKey.isEmpty
        ? const Scaffold(
            body: Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Falta configurar Supabase. Consulta el README de la aplicación móvil.',
                ),
              ),
            ),
          )
        : const AuthGate(),
  );
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final StreamSubscription<AuthState> subscription;
  @override
  void initState() {
    super.initState();
    subscription = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    subscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Supabase.instance.client.auth.currentSession == null
      ? const LoginPage()
      : const InventoryPage();
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(), password = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> signIn() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: email.text.trim(),
        password: password.text,
      );
    } on AuthException catch (_) {
      if (mounted) {
        setState(
          () => error =
              'No se pudo iniciar sesión. Revisa tus datos y la conexión.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'Sin conexión con el servicio. Inténtalo de nuevo.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Form(
            key: form,
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.all(24),
              children: [
                const Icon(
                  Icons.visibility_outlined,
                  size: 64,
                  color: Color(0xff087f86),
                ),
                const SizedBox(height: 12),
                Text(
                  'OptiZap Móvil',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Text(
                  'Inventario de armazones en movimiento',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(labelText: 'Correo'),
                  validator: (v) => v == null || !v.contains('@')
                      ? 'Ingresa un correo válido'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: password,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: const InputDecoration(labelText: 'Contraseña'),
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Ingresa tu contraseña' : null,
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: busy ? null : signIn,
                  child: Text(busy ? 'Entrando…' : 'Entrar'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key});
  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  late final repo = InventoryRepository(Supabase.instance.client);
  final sku = TextEditingController(),
      quantity = TextEditingController(text: '1'),
      note = TextEditingController();
  FrameItem? selected;
  String? role, error, requestId;
  bool busy = false;
  int direction = 1;
  List<StockMovement> history = [];
  @override
  void initState() {
    super.initState();
    loadRole();
  }

  @override
  void dispose() {
    sku.dispose();
    quantity.dispose();
    note.dispose();
    super.dispose();
  }

  Future<void> loadRole() async {
    try {
      final value = await repo.currentRole();
      if (mounted) {
        setState(() {
          role = value;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          role = 'error';
          error = 'No se pudo verificar tu permiso.';
        });
      }
    }
  }

  Future<void> findSku([String? scanned]) async {
    if (busy) return;
    if (scanned != null) sku.text = scanned.trim();
    if (sku.text.trim().isEmpty) {
      setState(() => error = 'Escanea o escribe un código.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
      selected = null;
      requestId = null;
      history = [];
    });
    try {
      final item = await repo.findFrame(sku.text.trim());
      if (!mounted) return;
      setState(() {
        selected = item;
        error = item == null ? 'Armazón no encontrado.' : null;
      });
      if (item != null) {
        await loadHistory(item.id);
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'No se pudo consultar. Revisa la conexión.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> loadHistory(String id) async {
    try {
      final rows = await repo.history(id);
      if (mounted && selected?.id == id) setState(() => history = rows);
    } catch (_) {
      if (mounted) {
        setState(() => history = []);
      }
    }
  }

  Future<void> scan() async {
    final code = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const ScanPage()));
    if (code != null && mounted) await findSku(code);
  }

  Future<void> save() async {
    final item = selected;
    if (item == null || busy) return;
    final validation = validateMovement(quantity.text, direction, item.stock);
    if (validation != null) {
      setState(() => error = validation);
      return;
    }
    setState(() {
      busy = true;
      error = null;
      requestId ??= const Uuid().v4();
    });
    try {
      final movement = await repo.recordMovement(
        frameId: item.id,
        delta: direction * int.parse(quantity.text.trim()),
        note: note.text.trim(),
        requestId: requestId!,
      );
      if (!mounted) return;
      setState(() {
        selected = item.copyWith(stock: movement.stockAfter);
        quantity.text = '1';
        note.clear();
        requestId = null;
      });
      await loadHistory(item.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Movimiento confirmado en Supabase.')),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'No se pudo confirmar. Revisa el historial y reintenta: se usará el mismo identificador para evitar duplicados.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canMove = role == 'admin' || role == 'vendedor';
    return Scaffold(
      appBar: AppBar(
        title: const Text('OptiZap · Inventario'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () async => Supabase.instance.client.auth.signOut(),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              'Escanear armazón',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const Text(
              'Consulta y ajusta existencias desde el mostrador o almacén.',
            ),
            const SizedBox(height: 18),
            if (role == null) const LinearProgressIndicator(),
            if (role != null && !canMove)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    role == 'error' ? 'No se pudo verificar tu perfil.' : 'Tu rol no permite registrar movimientos. Contacta a administración.',
                  ),
                ),
              ),
            TextField(
              controller: sku,
              enabled: !busy,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Código SKU o código de barras',
              ),
              onSubmitted: (_) => findSku(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: busy ? null : scan,
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Escanear'),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: busy ? null : () => findSku(),
                  child: const Text('Buscar'),
                ),
              ],
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (selected != null) ...[
              const SizedBox(height: 18),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        selected!.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text('${selected!.sku} · ${selected!.brand}'),
                      const SizedBox(height: 8),
                      Text(
                        'Existencia: ${selected!.stock}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
              ),
              if (canMove) ...[
                const SizedBox(height: 14),
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(
                      value: 1,
                      label: Text('Entrada'),
                      icon: Icon(Icons.add),
                    ),
                    ButtonSegment(
                      value: -1,
                      label: Text('Salida'),
                      icon: Icon(Icons.remove),
                    ),
                  ],
                  selected: {direction},
                  onSelectionChanged: busy
                      ? null
                      : (value) => setState(() {
                          direction = value.first;
                          requestId = null;
                          error = null;
                        }),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: quantity,
                  enabled: !busy,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Cantidad'),
                  onChanged: (_) => requestId = null,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: note,
                  enabled: !busy,
                  maxLength: 200,
                  decoration: const InputDecoration(
                    labelText: 'Motivo (opcional)',
                  ),
                  onChanged: (_) => requestId = null,
                ),
                FilledButton(
                  onPressed: busy ? null : save,
                  child: Text(busy ? 'Guardando…' : 'Confirmar movimiento'),
                ),
              ],
              const SizedBox(height: 20),
              Text(
                'Movimientos recientes',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (history.isEmpty) const Text('Aún no hay movimientos.'),
              for (final movement in history)
                ListTile(
                  leading: Icon(
                    movement.delta > 0
                        ? Icons.arrow_downward
                        : Icons.arrow_upward,
                  ),
                  title: Text(
                    '${movement.delta > 0 ? '+' : ''}${movement.delta} unidades',
                  ),
                  subtitle: Text(
                    '${movement.createdAt} · Saldo ${movement.stockAfter}',
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});
  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  bool found = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Escanear código')),
    body: Stack(
      children: [
        MobileScanner(
          onDetect: (capture) {
            if (found) return;
            for (final code in capture.barcodes) {
              final value = code.rawValue?.trim();
              if (value != null && value.isNotEmpty) {
                found = true;
                Navigator.of(context).pop(value);
                break;
              }
            }
          },
        ),
        const Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: EdgeInsets.all(28),
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'Apunta la cámara al código de barras del armazón.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
