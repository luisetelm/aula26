import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { emailAllowed, freeSeats, subjectByJoinCode } from "@/lib/seats";
import { Portada } from "@/components/portada";
import { LoginForm } from "@/app/login/login-form";
import { ElegirNombre } from "./elegir-nombre";

// Enlace de inscripción: entras con tu correo de la escuela y eliges tu nombre en el listado.
export default async function UnirsePage({ params }: PageProps<"/unirse/[code]">) {
  const { code } = await params;
  const subject = await subjectByJoinCode(code);
  if (!subject) {
    return (
      <Portada>
        <h2 className="mb-4 text-2xl font-semibold">Enlace no válido</h2>
        <p className="text-gris">Este enlace de inscripción ya no funciona. Pide el enlace actual a tu profesor o profesora.</p>
      </Portada>
    );
  }
  const titulo = `${subject.name}${subject.group ? ` · Grupo ${subject.group}` : ""}`;

  const user = await getCurrentUser();
  if (!user) {
    return (
      <Portada>
        <p className="etiqueta">Inscripción · {subject.academicYear}</p>
        <h2 className="mt-1 text-2xl font-semibold">{titulo}</h2>
        <p className="mt-2 mb-6 text-gris">
          Entra con tu correo{subject.emailDomain ? ` de @${subject.emailDomain}` : " de la escuela"}. Te enviaremos un código para
          entrar; después eliges tu nombre en el listado de la clase.
        </p>
        <LoginForm next={`/unirse/${code}`} join={code} />
      </Portada>
    );
  }

  const enrolled = await db.enrollment.findUnique({ where: { userId_subjectId: { userId: user.id, subjectId: subject.id } } });
  if (enrolled) redirect(`/asignaturas/${subject.id}`);

  if (!emailAllowed(subject, user.email)) {
    return (
      <Portada>
        <h2 className="mb-4 text-2xl font-semibold">{titulo}</h2>
        <p className="text-gris">
          Has entrado como {user.email}. Para inscribirte tienes que usar tu correo de @{subject.emailDomain}: sal y vuelve a abrir
          el enlace.
        </p>
      </Portada>
    );
  }

  const seats = await freeSeats(subject.id);
  return (
    <Portada>
      <p className="etiqueta">Inscripción · {subject.academicYear}</p>
      <h2 className="mt-1 text-2xl font-semibold">{titulo}</h2>
      {seats.length === 0 ? (
        <p className="mt-4 text-gris">No quedan nombres libres en el listado. Habla con tu profesor o profesora para que te añada.</p>
      ) : (
        <>
          <p className="mt-2 mb-4 text-gris">Elige tu nombre. Lo verá tu profesor o profesora junto a tu correo, {user.email}.</p>
          <ElegirNombre code={code} seats={seats.map((s) => ({ id: s.id, name: s.name }))} />
        </>
      )}
    </Portada>
  );
}
