# API_CONTRACT.md - Contrato de Datos y Server Actions (Optizap)

Este archivo documenta las tablas, tipos, consultas y Server Actions disponibles entre el **Agente Backend & DB (`feat/backend`)** y el **Agente Frontend & Diseño (`feat/frontend`)**.

---

## 1. Modelos y Tipos Base (`/src/types/database.ts`)

- **`UserRole`**: `'admin' | 'optometrista' | 'vendedor' | 'cliente'`
- **`UserProfile`**: Perfil de usuario vinculado a `auth.users` con rol asignado.
- **`Brand`**: Marca de armazones / productos ópticos (`id`, `name`, `slug`, `logo_url`, `description`, `country`, `is_active`, `created_at`).
- **`Frame`**: Armazón o lente dentro del catálogo (`id`, `brand_id`, `sku`, `name`, `material`, `shape`, `gender`, `price`, `stock`, `image_url`, `is_active`, `created_at`).

---

## 2. Server Actions / Endpoints Disponibles

*(El Agente Backend documentará aquí cada Server Action o Route Handler creado en `/src/actions/**` o `/src/app/api/**`)*

### Autenticación y Roles
- *Por implementar por Backend*

### Catálogo de Marcas y Armazones
- *Por implementar por Backend*

---

## Pendientes para Backend

*(Sección mantenida por el Agente Frontend para solicitar nuevos endpoints, consultas o campos sin romper el código existente)*

- [ ] Implementar Server Actions para obtener y filtrar el catálogo de marcas (`getBrands`, `getBrandBySlug`) y armazones (`getFrames`).
- [ ] Implementar gestión de sesión y obtención del rol del usuario actual (`getCurrentUserProfile`).
- [ ] Definir políticas RLS en Supabase según el rol (`admin`, `optometrista`, `vendedor`, `cliente`).
