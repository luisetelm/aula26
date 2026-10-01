# Aula26

Aula virtual para asignaturas: alumnos y profesores dados de alta desde Excel, acceso por enlace mágico enviado desde Gmail, timeline de sesiones y (próximamente) publicación de contenido desde Claude vía MCP.

## Estado

- **Fase 1 (hecha):** login por enlace mágico, asignaturas, importación de alumnos y profesores desde .xlsx/.csv, gestión de personas por asignatura.
- **Fase 2:** timeline de sesiones, material (archivo, enlace o texto) y pruebas, con publicación inmediata, programada o en borrador.
- Fase 3: entregas y notas.
- Fase 4: servidor MCP y propuesta de notas finales con IA.

## Desarrollo local

```bash
cp .env.example .env      # y ajusta DATABASE_URL a tu Postgres
npm install
npx prisma migrate dev
npm run dev
```

Entra en http://localhost:3000/login con un correo de `ADMIN_EMAILS`. Sin SMTP configurado, el enlace de acceso aparece en la consola.

Tests: `npm test`.

## Puesta en marcha (Vercel + Supabase)

1. **Supabase:** crea un proyecto y copia las dos cadenas de conexión (botón Connect > ORMs > Prisma) en `DATABASE_URL` y `DIRECT_URL`, como explica `.env.example`. En Storage crea un bucket privado llamado `aula26` con un límite de 50 MB por archivo, y copia la URL del proyecto, la clave publishable y la secret key en las variables `SUPABASE_*`.
2. **Gmail:** en tu cuenta de la escuela activa la verificación en dos pasos y crea una contraseña de aplicación (Cuenta de Google > Seguridad > Contraseñas de aplicación). Ponla en `SMTP_PASSWORD` y tu correo en `SMTP_USER`. Si la opción no aparece, el administrador de Workspace la tiene desactivada.
3. **Vercel:** importa el repositorio, añade las variables de `.env.example` y despliega. El script `vercel-build` aplica las migraciones automáticamente.
4. **Dominio propio (opcional):** en Vercel > Project > Settings > Domains añade el dominio y crea el registro DNS que te indique. Actualiza `APP_URL`.

## Timeline y publicación

- Cada sesión tiene fecha, título, programación (Markdown) y una fecha de publicación: ya, desde una fecha concreta o borrador.
- El material y las pruebas pueden tener su propia fecha de publicación; si no, salen con la sesión.
- Los alumnos solo ven lo publicado. Los archivos se sirven con enlaces temporales y solo a quien puede verlos.
- Los archivos se suben directamente del navegador a Supabase Storage (hasta 50 MB).

## Cómo funciona el acceso

- Solo pueden entrar correos dados de alta (o los de `ADMIN_EMAILS`).
- El enlace caduca a los 15 minutos y sirve una sola vez. Se confirma con un botón para que los antivirus que abren enlaces no lo gasten.
- Máximo 5 enlaces por correo y hora.
- La sesión dura 30 días.

## Roles

- **Administrador:** crea asignaturas y ve todas.
- **Profesor de una asignatura:** importa y gestiona personas de esa asignatura.
- **Alumno:** ve las asignaturas en las que está matriculado.
