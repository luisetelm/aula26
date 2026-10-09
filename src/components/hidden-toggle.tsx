import { setHiddenAction } from "@/app/asignaturas/[id]/sesiones/actions";

// Botón del profesorado para ocultar o mostrar al alumnado un material o una tarea.
export function HiddenToggle({
  subjectId,
  kind,
  id,
  hidden,
  oscuro = false,
}: {
  subjectId: string;
  kind: "material" | "assessment";
  id: string;
  hidden: boolean;
  oscuro?: boolean;
}) {
  return (
    <form action={setHiddenAction.bind(null, subjectId, kind, id, !hidden)} className="inline-flex items-center gap-2">
      {hidden && <span className={`badge ${oscuro ? "border-ocre bg-ocre text-grafito" : "border-ocre bg-ocre text-grafito"}`}>Oculto al alumnado</span>}
      <button className={`text-sm hover:underline ${oscuro ? "text-papel underline-offset-4" : "enlace"}`}>{hidden ? "Mostrar" : "Ocultar"}</button>
    </form>
  );
}
