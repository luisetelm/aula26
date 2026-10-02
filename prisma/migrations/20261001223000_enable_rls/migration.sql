-- En Supabase, las tablas del esquema public son accesibles por la API REST con la clave pública.
-- La app usa su propio esquema (?schema=aula26), pero activamos RLS sin políticas como segunda barrera:
-- solo el propietario de las tablas (la conexión de Prisma) puede leerlas o escribirlas.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoredFile" ENABLE ROW LEVEL SECURITY;
