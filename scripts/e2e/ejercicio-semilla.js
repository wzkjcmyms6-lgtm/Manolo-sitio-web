// Datos de prueba realistas para Ejercicio (auditoría y scripts/e2e/ejercicio.js):
// 9 semanas de Empuje / Tirón / Pierna con progresión, un press de banca
// estancado en las últimas semanas, rutinas con plan semanal, pesajes y
// carreras (una larga ayer). Todo determinista.
//
// estado(hoy, opciones) → { __SEED__ } para comun.abrir(); hoy = "AAAA-MM-DD".
// opciones: { semanas (9), sinCarreraAyer, sinEntrenos, sinRutinas,
//   cansado (las 2 últimas semanas: menos fuerza en 2 ejercicios y más esfuerzo) }.

const R = (nombre, exerciseId, series, repsMin, repsMax, descansoSeg, peso) =>
  ({ nombre, exerciseId, series, repsMin, repsMax, peso: peso == null ? null : peso, descansoSeg, notas: "", incremento: null });

const RUTINAS = {
  empuje: { name: "Empuje", orden: 0, v: 2, items: [
    R("Press de banca (Barra)", "barbell-bench-press-medium-grip", 4, 6, 8, 150, 70),
    R("Press de banca inclinado (Mancuerna)", "incline-dumbbell-press", 3, 8, 10, 120, 24),
    R("Press militar (Barra)", "standing-military-press", 3, 6, 8, 120, 40),
    R("Elevación lateral (Mancuerna)", "side-lateral-raise", 3, 12, 15, 60, 8),
    R("Jalón de tríceps (Polea)", "triceps-pushdown", 3, 10, 12, 60, 25)
  ] },
  tiron: { name: "Tirón", orden: 1, v: 2, items: [
    R("Dominadas", "pullups", 4, 6, 10, 150, null),
    R("Remo inclinado (Barra)", "bent-over-barbell-row", 4, 6, 8, 120, 60),
    R("Remo sentado (Polea)", "seated-cable-rows", 3, 10, 12, 90, 50),
    R("Face pull (Polea)", "face-pull", 3, 12, 15, 60, 20),
    R("Curl de bíceps (Barra)", "barbell-curl", 3, 8, 12, 60, 25)
  ] },
  pierna: { name: "Pierna", orden: 2, v: 2, items: [
    R("Sentadilla (Barra)", "barbell-squat", 4, 5, 8, 180, 90),
    R("Peso muerto rumano (Barra)", "romanian-deadlift", 3, 8, 10, 150, 70),
    R("Prensa de piernas (Máquina)", "leg-press", 3, 10, 12, 120, 150),
    R("Curl femoral tumbado (Máquina)", "lying-leg-curls", 3, 10, 12, 60, 35),
    R("Elevación de talones de pie (Máquina)", "standing-calf-raises", 3, 12, 15, 60, 60)
  ] }
};
// Rutina vieja (solo nombres), como las que tenía el dueño antes de v:2.
const VIEJA = { name: "Brazos (vieja)", orden: 3, exercises: ["Curl de bíceps (Mancuerna)", "Fondos en paralelas"] };

function addDias(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diaSemana(iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); }

// Peso de trabajo de la semana s (0 = la más vieja) para cada ejercicio.
// Banca sube hasta la semana 4 y después se estanca (para el estancamiento).
function pesoSemana(id, s, base) {
  const sube = { "barbell-bench-press-medium-grip": [2.5, 4], "barbell-squat": [5, 9], "romanian-deadlift": [5, 9],
    "bent-over-barbell-row": [2.5, 9], "standing-military-press": [2.5, 9], "leg-press": [10, 9], "incline-dumbbell-press": [2, 9],
    "seated-cable-rows": [5, 9], "triceps-pushdown": [2.5, 9], "barbell-curl": [2.5, 9], "lying-leg-curls": [5, 9],
    "standing-calf-raises": [5, 9], "face-pull": [2.5, 9], "side-lateral-raise": [1, 9] }[id] || [0, 0];
  const pasos = Math.floor(Math.min(s, sube[1]) / 2);
  return base + sube[0] * pasos;
}

function entreno(fecha, clave, s, n, cansado) {
  const r = RUTINAS[clave];
  const inicio = Date.parse(`${fecha}T19:00:00-04:00`);
  const exercises = r.items.map((it, k) => {
    const sets = [];
    if (k === 0 && it.peso) {
      const w = pesoSemana(it.exerciseId, s, it.peso);
      sets.push({ kg: Math.round(w * 0.5 / 2.5) * 2.5, reps: 8, calentamiento: true });
    }
    for (let i = 0; i < it.series; i++) {
      if (it.exerciseId === "pullups") { sets.push({ kg: s > 5 ? 5 : 0, reps: Math.max(5, Math.min(10, 6 + (s % 4) - (i > 1 ? 1 : 0))) }); continue; }
      const kg = pesoSemana(it.exerciseId, s, it.peso);
      // Reps: arriba del rango la semana impar (justo antes de subir), abajo al subir.
      const estancada = it.exerciseId === "barbell-bench-press-medium-grip" && s >= 5;
      const reps = estancada ? [6, 6, 5, 5][i] || 5 : (s % 2 ? it.repsMax : it.repsMin) - (i === it.series - 1 && (n + i) % 3 === 0 ? 1 : 0);
      sets.push({ kg, reps: Math.max(1, reps - (cansado === 2 && k < 2 ? 3 : 0)) });
    }
    const ex = { name: it.nombre, exerciseId: it.exerciseId, sets };
    if (k < 2) ex.rpe = cansado ? 9 + (k % 2) : 7 + ((s + k) % 3);
    return ex;
  });
  const w = { date: fecha, name: r.name, startedAt: inicio, durationMin: 52 + ((s * 7 + n) % 15), exercises, prs: 0, rutinaId: clave };
  if (cansado) w.rpeSesion = 9;
  return w;
}

function estado(hoy, opciones) {
  const o = Object.assign({ semanas: 9 }, opciones || {});
  const seed = {};
  const entrenos = {}, running = {};
  // Lunes de la semana actual.
  const lunes = addDias(hoy, -((diaSemana(hoy) + 6) % 7));
  let n = 0;
  if (!o.sinEntrenos) {
    for (let s = 0; s < o.semanas; s++) {
      const lun = addDias(lunes, -7 * (o.semanas - 1 - s));
      // Lunes Empuje, martes Tirón, jueves Pierna; sábados alternos Empuje.
      [[0, "empuje"], [1, "tiron"], [3, "pierna"], [5, "empuje"]].forEach(([d, clave]) => {
        if (d === 5 && s % 2) return;
        const f = addDias(lun, d);
        if (f >= hoy) return;           // hoy todavía no entrenó
        // Cansado: la semana pasada con más esfuerzo; esta, además, con menos fuerza.
        const cansado = o.cansado && s >= o.semanas - 2 ? (s === o.semanas - 1 ? 2 : 1) : 0;
        entrenos[`w${String(++n).padStart(3, "0")}`] = entreno(f, clave, s, n, cansado);
      });
    }
    // Un entreno libre sin rutina, con un ejercicio sin reconocer.
    const libre = addDias(lunes, -10);
    entrenos.libre = { date: libre, name: "Brazos en casa", startedAt: Date.parse(`${libre}T08:00:00-04:00`), durationMin: 30, prs: 0,
      exercises: [{ name: "Curl de bíceps (Mancuerna)", exerciseId: "dumbbell-bicep-curl", sets: [{ kg: 12, reps: 12 }, { kg: 12, reps: 10 }] },
        { name: "Fondos en paralelas", exerciseId: "parallel-bar-dip", sets: [{ kg: 0, reps: 12 }, { kg: 0, reps: 10 }] },
        { name: "Curl martillo raro", sets: [{ kg: 10, reps: 10 }] }] };
    // Carreras: miércoles (fácil) y domingo (larga); ayer, una larga.
    for (let s = 0; s < o.semanas; s++) {
      const lun = addDias(lunes, -7 * (o.semanas - 1 - s));
      [[2, 6, 36], [6, 12 + (s % 3) * 2, 72 + (s % 3) * 12]].forEach(([d, km, min], k) => {
        const f = addDias(lun, d);
        if (f >= hoy) return;
        running[`r${s}_${k}`] = { date: f, distance: km, duration: min, notes: "", rpe: k ? 7 : 4 };
      });
    }
    const ayer = addDias(hoy, -1);
    if (!o.sinCarreraAyer) running.ayer = { date: ayer, distance: 18, duration: 108, notes: "Fondo largo", rpe: 8 };
    else delete running[Object.keys(running).find(k => running[k].date === ayer)];
  }
  seed["users/test/entrenamientos"] = entrenos;
  seed["users/test/running"] = running;
  if (!o.sinRutinas) {
    seed["users/test/rutinas"] = { empuje: RUTINAS.empuje, tiron: RUTINAS.tiron, pierna: RUTINAS.pierna, vieja: VIEJA };
    seed["users/test/meta"] = { plan_semanal: { dias: { 1: "empuje", 2: "tiron", 4: "pierna", 6: "empuje" } } };
  } else seed["users/test/meta"] = {};
  Object.assign(seed["users/test/meta"], {
    perfil_ejercicio: { sexo: "hombre", alturaCm: 178, pesajes: { [addDias(hoy, -60)]: 84, [addDias(hoy, -20)]: 82.5 } },
    ajustes_ejercicio: { pesoCorporal: 82.5 }
  });
  return { __SEED__: seed };
}

module.exports = { estado, RUTINAS, addDias };
