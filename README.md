# OptiZap

Sistema de óptica con una aplicación web en Next.js y un complemento móvil
nativo en Flutter para consultar y mover inventario de armazones mediante
códigos de barras. Ambos usan las tablas normalizadas de Supabase.

- Web: `npm ci && npm run dev`. Copiar `.env.example` a `.env.local` y
  configurar URL y clave pública de Supabase.
- Móvil: instrucciones en [mobile/README.md](mobile/README.md).
- Entrega académica: [mobile/docs/PROYECTO_FINAL.md](mobile/docs/PROYECTO_FINAL.md).
- Esquema y políticas: [supabase/migrations](supabase/migrations).
- Contrato de datos: [API_CONTRACT.md](API_CONTRACT.md).

La PWA publicada previamente usa `optizap_prototype_state` para una
demostración anterior. El inventario estructurado de este repositorio utiliza
`frames` y `stock_movements`; los registros de la PWA no se migran
automáticamente. No se deben registrar pacientes reales en datos de prueba.
