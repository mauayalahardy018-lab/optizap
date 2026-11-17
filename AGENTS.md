# AGENTS.md - Arquitectura y Reglas de Colaboración (Optizap)

## Stack Tecnológico
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS.
- **Backend y Base de Datos:** Supabase (PostgreSQL, Auth, RLS), Next.js Server Actions / Route Handlers.

## División de Responsabilidades (Estricta)

### 1. Agente Backend & DB (GPT / Codex)
- **Rama de Git asignada:** `feat/backend`
- **Carpetas permitidas:** `/supabase/**`, `/src/lib/supabase/**`, `/src/actions/**`, `/src/app/api/**`, `/src/types/database.ts`, `/API_CONTRACT.md`.
- **Prohibido:** Modificar archivos de interfaz en `/src/components/**` o estilos visuales en `/src/app/**/page.tsx` (a menos que sea solo para conectar datos mínimos de prueba).
- **Obligación:** Cada vez que cree o modifique una tabla, consulta o Server Action, debe actualizar `/src/types/database.ts` y documentar las entradas/salidas en `/API_CONTRACT.md`.

### 2. Agente Frontend & Diseño (Antigravity)
- **Rama de Git asignada:** `feat/frontend`
- **Carpetas permitidas:** `/src/components/**`, `/src/app/**/page.tsx`, `/src/app/**/layout.tsx`, `/public/**`, estilos CSS/Tailwind.
- **Prohibido:** Modificar esquemas SQL, políticas RLS, lógica de base de datos o archivos dentro de `/src/actions/**` y `/src/lib/supabase/**`.
- **Obligación:** Consumir únicamente los tipos definidos en `/src/types/database.ts` y las funciones documentadas en `/API_CONTRACT.md`. Si necesita un endpoint o dato nuevo que no existe, debe anotarlo al final de `/API_CONTRACT.md` bajo la sección `## Pendientes para Backend` sin romper el código existente.

## Reglas de Git
- Nunca hacer push directo a `main` sin revisión.
- Hacer commits atómicos y descriptivos después de cada módulo funcional (ej. `feat(db): crear esquema de pacientes e historial clínico` o `feat(ui): diseñar catálogo de armazones`).
