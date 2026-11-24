import 'package:supabase_flutter/supabase_flutter.dart';

String? validateMovement(String quantity, int direction, int stock) {
  final amount = int.tryParse(quantity.trim());
  if (amount == null || amount < 1 || amount > 999) {
    return 'La cantidad debe ser un entero entre 1 y 999.';
  }
  if (direction != 1 && direction != -1) return 'Selecciona entrada o salida.';
  if (direction == -1 && amount > stock) {
    return 'No hay existencias suficientes.';
  }
  return null;
}

class FrameItem {
  const FrameItem({
    required this.id,
    required this.sku,
    required this.name,
    required this.brand,
    required this.stock,
  });
  final String id, sku, name, brand;
  final int stock;
  factory FrameItem.fromJson(Map<String, dynamic> json) => FrameItem(
    id: json['id'] as String,
    sku: json['sku'] as String,
    name: json['name'] as String,
    stock: json['stock'] as int,
    brand:
        (json['brand'] as Map<String, dynamic>?)?['name'] as String? ??
        'Sin marca',
  );
  FrameItem copyWith({int? stock}) => FrameItem(
    id: id,
    sku: sku,
    name: name,
    brand: brand,
    stock: stock ?? this.stock,
  );
}

class StockMovement {
  const StockMovement({
    required this.delta,
    required this.stockAfter,
    required this.createdAt,
  });
  final int delta, stockAfter;
  final String createdAt;
  factory StockMovement.fromJson(Map<String, dynamic> json) => StockMovement(
    delta: json['delta'] as int,
    stockAfter: json['stock_after'] as int,
    createdAt: (json['created_at'] as String)
        .replaceFirst('T', ' ')
        .substring(0, 16),
  );
}

class InventoryRepository {
  const InventoryRepository(this.client);
  final SupabaseClient client;
  Future<String> currentRole() async {
    final user = client.auth.currentUser;
    if (user == null) throw StateError('No hay sesión');
    final row = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    return row['role'] as String;
  }

  Future<FrameItem?> findFrame(String sku) async {
    final row = await client
        .from('frames')
        .select('id,sku,name,stock,brand:brands(name)')
        .eq('sku', sku)
        .eq('is_active', true)
        .maybeSingle();
    return row == null ? null : FrameItem.fromJson(row);
  }

  Future<List<StockMovement>> history(String frameId) async {
    final rows = await client
        .from('stock_movements')
        .select('delta,stock_after,created_at')
        .eq('frame_id', frameId)
        .order('created_at', ascending: false)
        .limit(10);
    return rows.map(StockMovement.fromJson).toList();
  }

  Future<StockMovement> recordMovement({
    required String frameId,
    required int delta,
    required String note,
    required String requestId,
  }) async {
    final row = await client.rpc(
      'record_frame_movement',
      params: {
        'p_frame_id': frameId,
        'p_delta': delta,
        'p_note': note.isEmpty ? null : note,
        'p_request_id': requestId,
      },
    );
    return StockMovement.fromJson(Map<String, dynamic>.from(row as Map));
  }
}
