import { toLocalInput } from "@/lib/time";

type Lesson = { date: Date; title: string; plan: string; publishAt: Date | null };

export function LessonFields({ lesson }: { lesson?: Lesson }) {
  const mode = !lesson ? "now" : !lesson.publishAt ? "draft" : lesson.publishAt > new Date() ? "at" : "now";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col text-sm">
          Fecha de la sesión
          <input name="date" type="date" required defaultValue={toLocalInput(lesson?.date).slice(0, 10)} className="input mt-1" />
        </label>
        <label className="flex flex-1 flex-col text-sm">
          Título
          <input name="title" required defaultValue={lesson?.title} className="input mt-1" placeholder="Sesión 1: Presentación" />
        </label>
      </div>
      <label className="flex flex-col text-sm">
        Qué haremos en clase
        <span className="text-gris">Un paso por línea empezando por «-». Añade «(10 min)» al final para la duración. Admite Markdown.</span>
        <textarea
          name="plan"
          rows={5}
          defaultValue={lesson?.plan}
          className="input mt-1 font-mono text-sm"
          placeholder={"- Repaso de la sesión anterior (10 min)\n- **Explicación**: tipos de entrevistas (25 min)\n- Práctica por parejas (20 min)"}
        />
      </label>
      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="mb-1">
          Visible para el alumnado <span className="text-gris">· hasta el día de la sesión solo verán el título y la fecha</span>
        </legend>
        <label className="flex items-center gap-1"><input type="radio" name="publishMode" value="now" defaultChecked={mode === "now"} /> Ya</label>
        <label className="flex items-center gap-1"><input type="radio" name="publishMode" value="at" defaultChecked={mode === "at"} /> Desde</label>
        <input name="publishAt" type="datetime-local" defaultValue={mode === "at" ? toLocalInput(lesson?.publishAt) : ""} className="input py-1" />
        <label className="flex items-center gap-1"><input type="radio" name="publishMode" value="draft" defaultChecked={mode === "draft"} /> Borrador</label>
      </fieldset>
    </div>
  );
}
