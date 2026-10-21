/*!
 * Manolo · Hábito "Scalping" — masaje del cuero cabelludo, plan de 180 días
 * ---------------------------------------------------------------------------
 * Módulo de contenido y lógica, sin dependencias.
 *   · Navegador (script clásico): queda disponible como window.ScalpingHabit
 *   · Node / CommonJS: const ScalpingHabit = require('./scalping-habit.js')
 * Todas las fechas son días de calendario LOCAL con formato 'YYYY-MM-DD'.
 * Base: Koyama et al. (Eplasty, 2016) y English & Barazesh (Dermatology and Therapy, 2019).
 * No cambies textos, números ni lógica: están verificados con selfTest().
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.ScalpingHabit = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  /* ============================ 1. Constantes ============================ */

  var VERSION = 1;
  var HABIT_ID = 'scalping';
  var HABIT_NAME = 'Scalping';
  var TOTAL_DAYS = 180;
  var DAY_MS = 86400000;
  var SESSIONS = ['manana', 'noche'];
  var PHOTO_DAYS = [1, 30, 60, 90, 120, 150, 180];
  var PHOTO_WINDOW = 3; // el aviso de fotos aparece desde 3 días antes hasta 3 días después
  var WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ============================ 2. Contenido ============================ */

  var MOVEMENTS = {
    calentamiento: {
      id: 'calentamiento',
      nombre: 'Calentamiento',
      instrucciones: 'Presiones suaves y rítmicas con las yemas por toda la cabeza.'
    },
    presiones: {
      id: 'presiones',
      nombre: 'Presiones',
      instrucciones: 'Con los nudillos o la base de la palma, presión firme punto por punto. Sostén 1–2 segundos y avanza 2–5 cm.'
    },
    pellizcos: {
      id: 'pellizcos',
      nombre: 'Pellizcos',
      instrucciones: 'Apoya las yemas de ambas manos separadas unos 3 cm. Presiona y júntalas para arrugar la piel entre ellas. Sostén 1–2 segundos y avanza. Sin tirar del pelo.'
    },
    estiramientos: {
      id: 'estiramientos',
      nombre: 'Estiramientos',
      instrucciones: 'Apoya las yemas juntas. Presiona y sepáralas para estirar la piel. Sostén 1–2 segundos y avanza.'
    }
  };

  var ZONES = {
    toda: { id: 'toda', nombre: 'Toda la cabeza' },
    entradas: { id: 'entradas', nombre: 'Entradas y sienes' },
    coronilla: { id: 'coronilla', nombre: 'Coronilla y parte superior' },
    costados: { id: 'costados', nombre: 'Costados y nuca' }
  };
  var PRIORITY_ZONES = ['entradas', 'coronilla', 'costados'];

  // Zona de la sesión de noche según el día de la semana (0 = domingo … 6 = sábado).
  var NIGHT_ZONE_BY_WEEKDAY = ['toda', 'entradas', 'coronilla', 'costados', 'entradas', 'coronilla', 'costados'];

  // Pasos de cada sesión como [movimiento, minutos]. El calentamiento siempre es en toda la cabeza.
  var PHASES = [
    {
      id: 1, nombre: 'Adaptación', desde: 1, hasta: 30,
      descripcion: 'Crear el hábito y acostumbrar el cuero cabelludo.',
      manana: [['calentamiento', 1], ['presiones', 2], ['estiramientos', 2]],
      noche: [['calentamiento', 2], ['presiones', 3], ['pellizcos', 3], ['estiramientos', 2]],
      nocheExtendida: null
    },
    {
      id: 2, nombre: 'Constancia', desde: 31, hasta: 90,
      descripcion: 'Subir los minutos y sostener la rutina.',
      manana: [['calentamiento', 2], ['presiones', 3], ['estiramientos', 3]],
      noche: [['calentamiento', 2], ['presiones', 4], ['pellizcos', 3], ['estiramientos', 3]],
      nocheExtendida: null
    },
    {
      id: 3, nombre: 'Intensificación', desde: 91, hasta: 180,
      descripcion: 'Llegar a 25 minutos al día y acumular las horas para evaluar.',
      manana: [['calentamiento', 2], ['presiones', 4], ['estiramientos', 4]],
      noche: [['calentamiento', 3], ['presiones', 4], ['pellizcos', 4], ['estiramientos', 4]],
      nocheExtendida: [['calentamiento', 3], ['presiones', 6], ['pellizcos', 6], ['estiramientos', 5]]
    }
  ];

  // Después del día 180 se mantiene la estructura de la fase 3.
  var MAINTENANCE = {
    id: 4, nombre: 'Mantenimiento', desde: 181, hasta: null,
    descripcion: 'Seguir con la estructura de la fase 3 si viste mejora o estabilización.',
    manana: PHASES[2].manana,
    noche: PHASES[2].noche,
    nocheExtendida: PHASES[2].nocheExtendida
  };

  // Hitos sobre los minutos REALES registrados.
  var MILESTONES = [
    { horas: 36.3, minutos: 2178, titulo: '36 horas', texto: 'En la encuesta, en promedio la mejora empezaba a notarse hacia las 36 horas.' },
    { horas: 50, minutos: 3000, titulo: '50 horas', texto: 'Mínimo recomendado antes de evaluar resultados.' },
    { horas: 65, minutos: 3900, titulo: '65 horas', texto: 'Plan de 6 meses completo.' }
  ];

  var CONTENT = {
    titulo: 'Scalping',
    subtitulo: 'Masaje del cuero cabelludo · plan de 180 días',
    objetivo: 'Mantener el cuero cabelludo sano, ganar algo de grosor en el pelo y frenar la caída si aparece. Es un complemento, no un tratamiento médico.',
    fundamento: [
      'Un estudio con 4 minutos diarios durante 24 semanas logró pelo algo más grueso, pero no más pelos ni un crecimiento más rápido (Koyama et al., 2016).',
      'En una encuesta con masaje dos veces al día, más minutos diarios y más meses se asociaron con mejores resultados. Los autores recomiendan acumular al menos 50 horas antes de evaluar (English y Barazesh, 2019).'
    ],
    momentos: {
      manana: 'Antes de salir de casa (8:20), en seco o en la ducha con champú. Siempre en toda la cabeza.',
      noche: 'Antes de dormir, en seco y sentado. Se enfoca en la zona del día.'
    },
    horario: [
      'Mañana: antes de salir de casa (8:20), en seco o en la ducha con champú. Siempre en toda la cabeza.',
      'Noche: antes de dormir, en seco y sentado. Se enfoca en la zona del día.',
      'Todos los días, incluidos sábados y domingos.'
    ],
    reglas: [
      'Usa las yemas de los dedos, los nudillos o las palmas. Nunca las uñas.',
      'Mueve la piel sobre el cráneo; no frotes el pelo.',
      'La presión debe ser firme, nunca dolorosa. Sostén cada movimiento 1–2 segundos y avanza 2–5 cm.',
      'Si te saltas una sesión, no la dupliques: sigue con la siguiente.'
    ],
    notaCalentamiento: 'El calentamiento siempre se hace en toda la cabeza. El resto de los movimientos se hace en toda la cabeza en la mañana y en la zona del día en la noche.',
    zonasSemana: [
      { dias: 'Lunes y jueves', zona: 'Entradas y sienes' },
      { dias: 'Martes y viernes', zona: 'Coronilla y parte superior' },
      { dias: 'Miércoles y sábado', zona: 'Costados y nuca' },
      { dias: 'Domingo', zona: 'Toda la cabeza, o tu zona prioritaria si notas que ralea' }
    ],
    queEsperar: [
      { etapa: 'Mes 1', texto: 'Adaptación, sin cambios visibles.' },
      { etapa: 'Meses 2–3', texto: 'Puede aumentar un poco la caída. En el estudio japonés, la cantidad de pelo bajó un 5% a las 12 semanas y se recuperó a las 24. No suspendas la rutina por eso.' },
      { etapa: 'Meses 4–6', texto: 'Si funciona, se nota como estabilización o algo más de grosor.' }
    ],
    aceite: [
      'Opcional y solo de noche.',
      'Mezcla 3 a 5 gotas de aceite esencial de romero en una cucharada de aceite base.',
      'Pruébalo antes en una zona pequeña, porque puede irritar.',
      'Lávate el pelo en la ducha de la mañana siguiente, aprovechando la sesión.'
    ],
    notaAceite: 'Aplica el aceite de romero diluido antes de empezar y lávate el pelo en la ducha de mañana.',
    pausaYConsulta: [
      'Pausa si tienes heridas, psoriasis, eczema o caspa fuerte.',
      'Si arde o duele, baja la presión.',
      'Nunca tires del pelo ni hagas "scalp popping".',
      'Si la caída es pareja por toda la cabeza, consulta a un dermatólogo: puede deberse a la tiroides o a falta de hierro o zinc. Consulta también si la caída es repentina o en parches.'
    ],
    decision: [
      'Compara las fotos del día 1 y del día 180.',
      'Si hay mejora o estabilización: sigue con la fase 3 como mantenimiento.',
      'Si no hay cambios y te preocupa la caída: consulta a un dermatólogo para evaluar finasterida o minoxidil, que sí tienen evidencia sólida.'
    ],
    fotos: 'Toma 4 fotos: frente, entrada izquierda, entrada derecha y coronilla. Usa siempre la misma luz, ángulo, distancia y peinado, con el pelo seco. Idealmente un domingo a la misma hora. Las fotos quedan en tu galería; aquí solo marcas el control.',
    textoNocheExtendida: 'Desde la fase 3 puedes alargar la noche a 20 minutos. Más minutos se asociaron con algo más de mejora, pero exigen bastante más tiempo.',
    fuentes: [
      'Koyama T, Kobayashi K, Hama T, Murakami K, Ogawa R. Standardized Scalp Massage Results in Increased Hair Thickness by Inducing Stretching Forces to Dermal Papilla Cells in the Subcutaneous Tissue. Eplasty. 2016;16:e8.',
      'English RS Jr, Barazesh JM. Self-Assessments of Standardized Scalp Massages for Androgenic Alopecia: Survey Results. Dermatol Ther (Heidelb). 2019;9(1):167–178.'
    ]
  };

  /* ============================ 3. Fechas ============================ */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function utcToISO(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) throw new Error('Fecha inválida (usa YYYY-MM-DD): ' + iso);
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  function isValidISO(iso) {
    try { return utcToISO(parseISO(iso)) === iso; } catch (e) { return false; }
  }

  // Fecha local de calendario. Nunca uses toISOString() para esto (en UTC−4 cambia de día a las 20:00).
  function toISODate(date) {
    if (typeof date === 'string' && isValidISO(date)) return date;
    var d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISO() { return toISODate(new Date()); }

  function addDays(iso, n) { return utcToISO(parseISO(iso) + n * DAY_MS); }

  function daysBetween(fromISO, toISO) { return Math.round((parseISO(toISO) - parseISO(fromISO)) / DAY_MS); }

  // Día del plan: la fecha de inicio es el día 1.
  function getDayNumber(startISO, dateISO) { return daysBetween(startISO, dateISO) + 1; }

  function getWeekday(iso) { return new Date(parseISO(iso)).getUTCDay(); }

  function formatFecha(iso) {
    var d = new Date(parseISO(iso));
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function formatHoras(minutos) {
    var h = Math.round((minutos / 60) * 10) / 10;
    return String(h).replace('.', ',') + ' h';
  }

  /* ============================ 4. Plan diario ============================ */

  function sumSpec(spec) {
    var s = 0;
    for (var i = 0; i < spec.length; i++) s += spec[i][1];
    return s;
  }

  function specToSteps(spec) {
    return spec.map(function (p) { return { id: p[0], nombre: MOVEMENTS[p[0]].nombre, minutos: p[1] }; });
  }

  function getPhase(dia) {
    if (dia < 1) return PHASES[0];
    for (var i = 0; i < PHASES.length; i++) {
      if (dia >= PHASES[i].desde && dia <= PHASES[i].hasta) return PHASES[i];
    }
    return MAINTENANCE;
  }

  function normalizeSettings(settings) {
    var s = settings || {};
    return {
      startDate: isValidISO(s.startDate) ? s.startDate : todayISO(),
      zonaPrioritaria: PRIORITY_ZONES.indexOf(s.zonaPrioritaria) >= 0 ? s.zonaPrioritaria : null,
      usarAceite: !!s.usarAceite,
      nocheExtendida: !!s.nocheExtendida
    };
  }

  function nightSpec(fase, settings) {
    return settings && settings.nocheExtendida && fase.nocheExtendida ? fase.nocheExtendida : fase.noche;
  }

  function getNightZone(dateISO, zonaPrioritaria) {
    var id = NIGHT_ZONE_BY_WEEKDAY[getWeekday(dateISO)];
    if (id === 'toda' && PRIORITY_ZONES.indexOf(zonaPrioritaria) >= 0) id = zonaPrioritaria;
    return ZONES[id];
  }

  function buildSession(id, spec, zona, extra) {
    var pasos = spec.map(function (p, i) {
      var mov = MOVEMENTS[p[0]];
      var area = p[0] === 'calentamiento' ? ZONES.toda : zona;
      return {
        orden: i + 1,
        id: mov.id,
        nombre: mov.nombre,
        minutos: p[1],
        segundos: p[1] * 60,
        zona: area.nombre,
        instrucciones: mov.instrucciones
      };
    });
    var out = {
      id: id,
      titulo: id === 'manana' ? 'Mañana' : 'Noche',
      zona: zona.nombre,
      zonaId: zona.id,
      minutos: sumSpec(spec),
      pasos: pasos
    };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  function plannedMinutesForDay(dia, settings) {
    if (dia < 1) return 0;
    var fase = getPhase(dia);
    return sumSpec(fase.manana) + sumSpec(nightSpec(fase, settings));
  }

  // Minutos que el plan acumula desde el día 1 hasta `dia` inclusive.
  function getPlannedCumulativeMinutes(dia, settings) {
    var total = 0;
    for (var d = 1; d <= dia; d++) total += plannedMinutesForDay(d, settings);
    return total;
  }

  function getExpectation(dia) {
    if (dia < 1) return { titulo: 'Aún no empiezas', texto: 'El plan arranca en la fecha de inicio. Toma las fotos del día 1 antes de la primera sesión.' };
    if (dia <= 30) return { titulo: 'Mes 1 · Adaptación', texto: 'Sin cambios visibles en el pelo. Lo importante es crear el hábito.' };
    if (dia <= 90) return { titulo: 'Meses 2–3', texto: CONTENT.queEsperar[1].texto };
    if (dia < TOTAL_DAYS) return { titulo: 'Meses 4–6', texto: CONTENT.queEsperar[2].texto };
    if (dia === TOTAL_DAYS) return { titulo: 'Día 180 · Decisión', texto: 'Compara las fotos del día 1 y de hoy y decide cómo seguir.' };
    return { titulo: 'Mantenimiento', texto: 'Si notaste mejora o estabilización, sigue con la estructura de la fase 3.' };
  }

  function getPhotoCheckpoint(dia, startISO) {
    if (dia < 1) return null;
    for (var i = 0; i < PHOTO_DAYS.length; i++) {
      var c = PHOTO_DAYS[i];
      if (Math.abs(dia - c) <= PHOTO_WINDOW) {
        return {
          checkpoint: c,
          esHoy: dia === c,
          fechaIdeal: startISO ? addDays(startISO, c - 1) : null,
          instrucciones: CONTENT.fotos
        };
      }
    }
    return null;
  }

  function getPhotoSchedule(startISO) {
    return PHOTO_DAYS.map(function (c) {
      var f = addDays(startISO, c - 1);
      return { checkpoint: c, fecha: f, fechaTexto: formatFecha(f) };
    });
  }

  // Todo lo que toca en una fecha: día del plan, fase, sesiones con pasos, zona, fotos y qué esperar.
  function getPlanForDate(settings, dateISO) {
    var s = normalizeSettings(settings);
    var fecha = dateISO ? toISODate(dateISO) : todayISO();
    var dia = getDayNumber(s.startDate, fecha);
    var fase = getPhase(dia);
    var zonaNoche = getNightZone(fecha, s.zonaPrioritaria);
    var manana = buildSession('manana', fase.manana, ZONES.toda, { momento: CONTENT.momentos.manana });
    var noche = buildSession('noche', nightSpec(fase, s), zonaNoche, {
      momento: CONTENT.momentos.noche,
      aceite: s.usarAceite,
      notaAceite: s.usarAceite ? CONTENT.notaAceite : null
    });
    var minutosPlan = dia >= 1 ? getPlannedCumulativeMinutes(dia, s) : 0;
    return {
      habitId: HABIT_ID,
      nombre: HABIT_NAME,
      fecha: fecha,
      fechaTexto: formatFecha(fecha),
      diaSemana: WEEKDAYS[getWeekday(fecha)],
      dia: dia,
      totalDias: TOTAL_DAYS,
      estado: dia < 1 ? 'pendiente' : (dia > TOTAL_DAYS ? 'mantenimiento' : 'activo'),
      diasParaEmpezar: dia < 1 ? 1 - dia : 0,
      progreso: Math.max(0, Math.min(dia, TOTAL_DAYS)) / TOTAL_DAYS,
      fase: { id: fase.id, nombre: fase.nombre, descripcion: fase.descripcion, desde: fase.desde, hasta: fase.hasta },
      nocheExtendidaDisponible: !!fase.nocheExtendida && dia >= 1,
      zonaNoche: { id: zonaNoche.id, nombre: zonaNoche.nombre },
      manana: manana,
      noche: noche,
      minutosDia: manana.minutos + noche.minutos,
      minutosPlanAcumulados: minutosPlan,
      horasPlanAcumuladas: minutosPlan / 60,
      fotos: getPhotoCheckpoint(dia, s.startDate),
      queEsperar: getExpectation(dia),
      mostrarDecision: dia >= TOTAL_DAYS
    };
  }

  function getWeekPreview(settings, desdeISO, n) {
    var desde = desdeISO ? toISODate(desdeISO) : todayISO();
    var out = [];
    for (var i = 0; i < (n || 7); i++) {
      var p = getPlanForDate(settings, addDays(desde, i));
      out.push({
        fecha: p.fecha,
        fechaTexto: p.fechaTexto,
        diaSemana: p.diaSemana,
        dia: p.dia,
        estado: p.estado,
        fase: p.fase.nombre,
        zonaNoche: p.zonaNoche.nombre,
        minutosManana: p.manana.minutos,
        minutosNoche: p.noche.minutos,
        tocaFoto: !!(p.fotos && p.fotos.esHoy)
      });
    }
    return out;
  }

  function getPhaseSummary() {
    return PHASES.map(function (f) {
      return {
        id: f.id,
        nombre: f.nombre,
        descripcion: f.descripcion,
        dias: f.desde + '–' + f.hasta,
        minutosManana: sumSpec(f.manana),
        minutosNoche: sumSpec(f.noche),
        minutosDia: sumSpec(f.manana) + sumSpec(f.noche),
        pasosManana: specToSteps(f.manana),
        pasosNoche: specToSteps(f.noche),
        minutosNocheExtendida: f.nocheExtendida ? sumSpec(f.nocheExtendida) : null
      };
    });
  }

  // Día y fecha en que el plan alcanza cada hito si se cumple al 100%.
  function getPlanMarkers(settings) {
    var s = normalizeSettings(settings);
    return MILESTONES.map(function (m) {
      var acum = 0, dia = 0;
      while (acum < m.minutos && dia < 2000) { dia++; acum += plannedMinutesForDay(dia, s); }
      return { horas: m.horas, titulo: m.titulo, dia: dia, fecha: addDays(s.startDate, dia - 1), fechaTexto: formatFecha(addDays(s.startDate, dia - 1)) };
    });
  }

  /* ============================ 5. Estado y registro ============================ */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function createInitialState(startISO) {
    return {
      version: VERSION,
      habitId: HABIT_ID,
      settings: normalizeSettings({ startDate: startISO ? toISODate(startISO) : todayISO() }),
      logs: {},
      fotos: {}
    };
  }

  function normalizeState(state) {
    var st = state ? clone(state) : {};
    return {
      version: VERSION,
      habitId: HABIT_ID,
      settings: normalizeSettings(st.settings),
      logs: st.logs && typeof st.logs === 'object' ? st.logs : {},
      fotos: st.fotos && typeof st.fotos === 'object' ? st.fotos : {}
    };
  }

  function normSession(x) {
    var hecho = !!(x && x.hecho);
    return { hecho: hecho, minutos: hecho && x && isNum(x.minutos) ? x.minutos : null };
  }

  function getLog(state, dateISO) {
    var l = (state && state.logs && state.logs[dateISO]) || {};
    return {
      manana: normSession(l.manana),
      noche: normSession(l.noche),
      aceite: !!l.aceite,
      nota: typeof l.nota === 'string' ? l.nota : ''
    };
  }

  // Marca o desmarca una sesión. opciones: { hecho: true|false, minutos: número }.
  // Si no se indican minutos, se guardan los del plan de ese día. Devuelve un estado NUEVO.
  function markSession(state, dateISO, sesion, opciones) {
    if (SESSIONS.indexOf(sesion) < 0) throw new Error('Sesión inválida: ' + sesion + " (usa 'manana' o 'noche')");
    var o = opciones || {};
    var st = normalizeState(state);
    var fecha = toISODate(dateISO);
    var log = getLog(st, fecha);
    if (o.hecho === false) {
      log[sesion] = { hecho: false, minutos: null };
    } else {
      var plan = getPlanForDate(st.settings, fecha);
      log[sesion] = { hecho: true, minutos: isNum(o.minutos) && o.minutos > 0 ? Math.round(o.minutos) : plan[sesion].minutos };
    }
    st.logs[fecha] = log;
    return st;
  }

  function setOil(state, dateISO, usado) {
    var st = normalizeState(state);
    var fecha = toISODate(dateISO);
    var log = getLog(st, fecha);
    log.aceite = !!usado;
    st.logs[fecha] = log;
    return st;
  }

  function setNote(state, dateISO, texto) {
    var st = normalizeState(state);
    var fecha = toISODate(dateISO);
    var log = getLog(st, fecha);
    log.nota = String(texto || '');
    st.logs[fecha] = log;
    return st;
  }

  // Marca el control de fotos (1, 30, 60, 90, 120, 150, 180). Con fecha null lo desmarca.
  function markPhotos(state, checkpoint, dateISO) {
    if (PHOTO_DAYS.indexOf(checkpoint) < 0) throw new Error('Control de fotos inválido: ' + checkpoint);
    var st = normalizeState(state);
    st.fotos[String(checkpoint)] = dateISO === null ? null : toISODate(dateISO || todayISO());
    return st;
  }

  function updateSettings(state, patch) {
    var st = normalizeState(state);
    var p = patch || {};
    var cur = st.settings;
    st.settings = normalizeSettings({
      startDate: p.startDate !== undefined && isValidISO(p.startDate) ? p.startDate : cur.startDate,
      zonaPrioritaria: p.zonaPrioritaria !== undefined ? p.zonaPrioritaria : cur.zonaPrioritaria,
      usarAceite: p.usarAceite !== undefined ? p.usarAceite : cur.usarAceite,
      nocheExtendida: p.nocheExtendida !== undefined ? p.nocheExtendida : cur.nocheExtendida
    });
    return st;
  }

  /* ============================ 6. Estadísticas ============================ */

  function sessionsDone(log) { return (log.manana.hecho ? 1 : 0) + (log.noche.hecho ? 1 : 0); }

  function isDayComplete(log) { return log.manana.hecho && log.noche.hecho; }

  // Un día está "completo" con mañana Y noche. Hoy incompleto no rompe la racha hasta que termine el día.
  function getStats(state, hoyISO) {
    var st = normalizeState(state);
    var s = st.settings;
    var hoy = hoyISO ? toISODate(hoyISO) : todayISO();
    var diaHoy = getDayNumber(s.startDate, hoy);
    var r = {
      diaHoy: diaHoy,
      minutosTotales: 0,
      horasTotales: 0,
      sesionesHechas: 0,
      sesionesPosibles: 0,
      cumplimiento: null,
      diasCompletos: 0,
      rachaActual: 0,
      mejorRacha: 0,
      minutosPlanHastaHoy: diaHoy >= 1 ? getPlannedCumulativeMinutes(diaHoy, s) : 0,
      hitos: [],
      siguienteHito: null,
      minutosParaSiguienteHito: null,
      fotosHechas: 0
    };
    var racha = 0;
    for (var d = 1; d <= diaHoy; d++) {
      var fecha = addDays(s.startDate, d - 1);
      var log = getLog(st, fecha);
      var hechas = sessionsDone(log);
      if (hechas) {
        var plan = null;
        for (var k = 0; k < SESSIONS.length; k++) {
          var ses = log[SESSIONS[k]];
          if (!ses.hecho) continue;
          if (isNum(ses.minutos)) {
            r.minutosTotales += ses.minutos;
          } else {
            plan = plan || getPlanForDate(s, fecha);
            r.minutosTotales += plan[SESSIONS[k]].minutos;
          }
        }
      }
      r.sesionesHechas += hechas;
      r.sesionesPosibles += d < diaHoy ? 2 : hechas;
      if (isDayComplete(log)) {
        r.diasCompletos++;
        racha++;
        if (racha > r.mejorRacha) r.mejorRacha = racha;
      } else if (d < diaHoy) {
        racha = 0;
      }
    }
    r.rachaActual = racha;
    r.horasTotales = r.minutosTotales / 60;
    r.cumplimiento = r.sesionesPosibles ? r.sesionesHechas / r.sesionesPosibles : null;
    r.hitos = MILESTONES.map(function (m) {
      return { horas: m.horas, minutos: m.minutos, titulo: m.titulo, texto: m.texto, alcanzado: r.minutosTotales >= m.minutos };
    });
    for (var i = 0; i < r.hitos.length; i++) {
      if (!r.hitos[i].alcanzado) {
        r.siguienteHito = r.hitos[i];
        r.minutosParaSiguienteHito = r.hitos[i].minutos - r.minutosTotales;
        break;
      }
    }
    for (var j = 0; j < PHOTO_DAYS.length; j++) if (st.fotos[String(PHOTO_DAYS[j])]) r.fotosHechas++;
    return r;
  }

  // Datos para el calendario/heatmap: un elemento por día del plan (o hasta hoy si ya pasó el día 180).
  function getHistory(state, hoyISO) {
    var st = normalizeState(state);
    var s = st.settings;
    var hoy = hoyISO ? toISODate(hoyISO) : todayISO();
    var diaHoy = getDayNumber(s.startDate, hoy);
    var ultimo = Math.max(TOTAL_DAYS, diaHoy);
    var out = [];
    for (var d = 1; d <= ultimo; d++) {
      var fecha = addDays(s.startDate, d - 1);
      var log = getLog(st, fecha);
      out.push({
        dia: d,
        fecha: fecha,
        futuro: d > diaHoy,
        esHoy: d === diaHoy,
        sesiones: sessionsDone(log),
        completo: isDayComplete(log),
        esDiaFoto: PHOTO_DAYS.indexOf(d) >= 0
      });
    }
    return out;
  }

  // Aviso dentro de la app: mañana pendiente entre 5:00 y 11:59; noche pendiente desde las 19:00.
  function getReminder(state, ahora) {
    var st = normalizeState(state);
    var now = ahora || new Date();
    var fecha = toISODate(now);
    var hora = now.getHours();
    var plan = getPlanForDate(st.settings, fecha);
    if (plan.estado === 'pendiente') return null;
    var log = getLog(st, fecha);
    if (!log.manana.hecho && hora >= 5 && hora < 12) {
      return { sesion: 'manana', minutos: plan.manana.minutos, texto: 'Sesión de mañana pendiente: ' + plan.manana.minutos + ' min, antes de salir de casa.' };
    }
    if (!log.noche.hecho && hora >= 19) {
      return { sesion: 'noche', minutos: plan.noche.minutos, texto: 'Sesión de noche pendiente: ' + plan.noche.minutos + ' min · ' + plan.noche.zona + '.' };
    }
    return null;
  }

  /* ============================ 7. Temporizador guiado ============================ */

  // Calcula todo con marcas de tiempo: sigue exacto aunque el celular bloquee la pantalla.
  // opciones: { onStep(paso, indice, anterior), onTick(estado), onFinish(estado), now, autoTick, intervalMs }
  function createGuidedTimer(pasos, opciones) {
    if (!pasos || !pasos.length) throw new Error('El temporizador necesita al menos un paso');
    var o = opciones || {};
    var now = typeof o.now === 'function' ? o.now : function () { return Date.now(); };
    var autoTick = o.autoTick !== false;
    var intervalMs = o.intervalMs || 250;
    var lista = pasos.map(function (p) {
      return {
        id: p.id,
        nombre: p.nombre,
        zona: p.zona,
        instrucciones: p.instrucciones,
        segundos: Math.max(1, Math.round(isNum(p.segundos) ? p.segundos : (p.minutos || 0) * 60))
      };
    });
    var totalSeg = 0;
    for (var i = 0; i < lista.length; i++) totalSeg += lista[i].segundos;
    var estado = 'listo';
    var inicio = 0;
    var acumuladoMs = 0;
    var anunciado = -1;
    var handle = null;

    function transcurridoMs() { return acumuladoMs + (estado === 'corriendo' ? Math.max(0, now() - inicio) : 0); }

    function inicioDePaso(idx) {
      var s = 0;
      for (var k = 0; k < idx && k < lista.length; k++) s += lista[k].segundos;
      return s;
    }

    function calcular() {
      var t = Math.min(transcurridoMs() / 1000, totalSeg);
      var resto = t, idx = 0;
      while (idx < lista.length && resto >= lista[idx].segundos) { resto -= lista[idx].segundos; idx++; }
      var fin = idx >= lista.length;
      if (fin) idx = lista.length - 1;
      return { indice: idx, restanteSeg: fin ? 0 : Math.ceil(lista[idx].segundos - resto), transcurridoSeg: Math.floor(t), fin: fin };
    }

    function snapshot() {
      var c = calcular();
      return {
        estado: estado,
        indice: c.indice,
        totalPasos: lista.length,
        paso: lista[c.indice],
        siguiente: lista[c.indice + 1] || null,
        restanteSeg: c.restanteSeg,
        transcurridoSeg: c.transcurridoSeg,
        totalSeg: totalSeg,
        restanteTotalSeg: totalSeg - c.transcurridoSeg,
        progreso: totalSeg ? c.transcurridoSeg / totalSeg : 0,
        completo: c.fin,
        minutosTranscurridos: c.transcurridoSeg / 60
      };
    }

    function arrancar() { if (autoTick && !handle && typeof setInterval === 'function') handle = setInterval(tick, intervalMs); }
    function parar() { if (handle) { clearInterval(handle); handle = null; } }

    function tick() {
      if (estado !== 'corriendo') return snapshot();
      var c = calcular();
      if (c.fin) {
        acumuladoMs = totalSeg * 1000;
        estado = 'terminado';
        parar();
        var fin = snapshot();
        if (o.onFinish) o.onFinish(fin);
        return fin;
      }
      if (c.indice !== anunciado) {
        var anterior = anunciado;
        anunciado = c.indice;
        if (o.onStep) o.onStep(lista[c.indice], c.indice, anterior);
      }
      var snap = snapshot();
      if (o.onTick) o.onTick(snap);
      return snap;
    }

    function start() {
      if (estado === 'corriendo' || estado === 'terminado') return snapshot();
      estado = 'corriendo';
      inicio = now();
      arrancar();
      return tick();
    }

    function pause() {
      if (estado !== 'corriendo') return snapshot();
      acumuladoMs = transcurridoMs();
      estado = 'pausado';
      parar();
      return snapshot();
    }

    function resume() { return estado === 'pausado' ? start() : snapshot(); }

    function skip() {
      if (estado === 'terminado') return snapshot();
      var c = calcular();
      acumuladoMs = Math.min(inicioDePaso(c.indice + 1), totalSeg) * 1000;
      if (estado === 'corriendo') inicio = now();
      if (estado === 'listo') return start();
      return estado === 'corriendo' ? tick() : snapshot();
    }

    // Termina antes de tiempo (o confirma el final). Devuelve el estado con `completo` y `minutosTranscurridos`.
    function finish() {
      if (estado === 'terminado') return snapshot();
      acumuladoMs = transcurridoMs();
      estado = 'terminado';
      parar();
      var fin = snapshot();
      if (o.onFinish) o.onFinish(fin);
      return fin;
    }

    // Detiene el intervalo sin avisar (al cerrar la pantalla del temporizador).
    function destroy() { parar(); }

    return {
      pasos: lista,
      totalSeg: totalSeg,
      start: start,
      pause: pause,
      resume: resume,
      skip: skip,
      finish: finish,
      destroy: destroy,
      tick: tick,
      getState: snapshot
    };
  }

  /* ============================ 8. Ayudas del navegador ============================ */

  var audioCtx = null;
  var browser = {
    // Llamar dentro del toque en "Iniciar" (iOS solo permite audio tras un gesto del usuario).
    prepareAudio: function () {
      try {
        var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (AC && !audioCtx) audioCtx = new AC();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      } catch (e) { /* sin audio */ }
    },
    beep: function (frecuencia, ms) {
      try {
        if (!audioCtx) return;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.frequency.value = frecuencia || 880;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + (ms || 180) / 1000);
      } catch (e) { /* sin audio */ }
    },
    vibrate: function (patron) {
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(patron || [200, 100, 200]);
      } catch (e) { /* sin vibración */ }
    },
    // Mantiene la pantalla encendida durante la sesión. Devuelve una promesa con el bloqueo o null.
    requestWakeLock: function () {
      try {
        if (typeof navigator !== 'undefined' && navigator.wakeLock && navigator.wakeLock.request) {
          return navigator.wakeLock.request('screen').catch(function () { return null; });
        }
      } catch (e) { /* no soportado */ }
      return Promise.resolve(null);
    }
  };

  /* ============================ 9. Autoprueba ============================ */

  function selfTest() {
    var fallos = [];
    var n = 0;
    function eq(nombre, real, esperado) {
      n++;
      if (JSON.stringify(real) !== JSON.stringify(esperado)) {
        fallos.push(nombre + ': esperado ' + JSON.stringify(esperado) + ', obtenido ' + JSON.stringify(real));
      }
    }
    var S = { startDate: '2026-10-21' };

    // Fechas
    eq('fecha local a las 21:30', toISODate(new Date(2026, 9, 20, 21, 30)), '2026-10-20');
    eq('día 1', getDayNumber('2026-10-21', '2026-10-21'), 1);
    eq('fecha del día 180', addDays('2026-10-21', 179), '2027-04-18');
    eq('fecha inválida', isValidISO('2026-02-30'), false);
    eq('formato de horas', formatHoras(1650), '27,5 h');

    // [fecha, día, fase, min. mañana, min. noche, zona de noche, estado]
    var casos = [
      ['2026-10-20', 0, 1, 5, 10, 'coronilla', 'pendiente'],
      ['2026-10-21', 1, 1, 5, 10, 'costados', 'activo'],
      ['2026-10-25', 5, 1, 5, 10, 'toda', 'activo'],
      ['2026-11-19', 30, 1, 5, 10, 'entradas', 'activo'],
      ['2026-11-20', 31, 2, 8, 12, 'coronilla', 'activo'],
      ['2027-01-18', 90, 2, 8, 12, 'entradas', 'activo'],
      ['2027-01-19', 91, 3, 10, 15, 'coronilla', 'activo'],
      ['2027-02-09', 112, 3, 10, 15, 'coronilla', 'activo'],
      ['2027-03-13', 144, 3, 10, 15, 'costados', 'activo'],
      ['2027-04-18', 180, 3, 10, 15, 'toda', 'activo'],
      ['2027-04-19', 181, 4, 10, 15, 'entradas', 'mantenimiento']
    ];
    casos.forEach(function (c) {
      var p = getPlanForDate(S, c[0]);
      eq(c[0] + ' día', p.dia, c[1]);
      eq(c[0] + ' fase', p.fase.id, c[2]);
      eq(c[0] + ' minutos mañana', p.manana.minutos, c[3]);
      eq(c[0] + ' minutos noche', p.noche.minutos, c[4]);
      eq(c[0] + ' zona noche', p.zonaNoche.id, c[5]);
      eq(c[0] + ' estado', p.estado, c[6]);
      eq(c[0] + ' pasos mañana suman', p.manana.pasos.reduce(function (a, x) { return a + x.minutos; }, 0), p.manana.minutos);
      eq(c[0] + ' pasos noche suman', p.noche.pasos.reduce(function (a, x) { return a + x.minutos; }, 0), p.noche.minutos);
    });
    eq('calentamiento de noche en toda la cabeza', getPlanForDate(S, '2026-10-21').noche.pasos[0].zona, 'Toda la cabeza');
    eq('pasos de noche en la zona del día', getPlanForDate(S, '2026-10-21').noche.pasos[1].zona, 'Costados y nuca');
    eq('día 180 muestra decisión', getPlanForDate(S, '2027-04-18').mostrarDecision, true);
    eq('día 179 sin decisión', getPlanForDate(S, '2027-04-17').mostrarDecision, false);

    // Minutos acumulados del plan
    eq('plan día 30', getPlannedCumulativeMinutes(30, S), 450);
    eq('plan día 90', getPlannedCumulativeMinutes(90, S), 1650);
    eq('plan día 112', getPlannedCumulativeMinutes(112, S), 2200);
    eq('plan día 144', getPlannedCumulativeMinutes(144, S), 3000);
    eq('plan día 180', getPlannedCumulativeMinutes(180, S), 3900);
    eq('marcadores del plan', getPlanMarkers(S).map(function (m) { return m.dia; }), [112, 144, 180]);
    eq('resumen de fases', getPhaseSummary().map(function (f) { return f.minutosDia; }), [15, 20, 25]);

    // Ajustes
    eq('domingo con zona prioritaria', getPlanForDate({ startDate: '2026-10-21', zonaPrioritaria: 'coronilla' }, '2026-10-25').zonaNoche.id, 'coronilla');
    eq('zona prioritaria inválida se ignora', getPlanForDate({ startDate: '2026-10-21', zonaPrioritaria: 'xyz' }, '2026-10-25').zonaNoche.id, 'toda');
    eq('noche extendida no aplica en fase 1', getPlanForDate({ startDate: '2026-10-21', nocheExtendida: true }, '2026-10-21').noche.minutos, 10);
    eq('noche extendida en fase 3', getPlanForDate({ startDate: '2026-10-21', nocheExtendida: true }, '2027-01-19').noche.minutos, 20);
    eq('aceite en la noche', getPlanForDate({ startDate: '2026-10-21', usarAceite: true }, '2026-10-21').noche.aceite, true);

    // Fotos
    eq('foto día 1', getPlanForDate(S, '2026-10-21').fotos.checkpoint, 1);
    eq('aviso de foto día 28', getPlanForDate(S, addDays('2026-10-21', 27)).fotos.checkpoint, 30);
    eq('sin foto día 34', getPlanForDate(S, addDays('2026-10-21', 33)).fotos, null);
    eq('calendario de fotos', getPhotoSchedule('2026-10-21').map(function (f) { return f.fecha; }),
      ['2026-10-21', '2026-11-19', '2026-12-19', '2027-01-18', '2027-02-17', '2027-03-19', '2027-04-18']);

    // Registro y estadísticas
    var st = createInitialState('2026-10-21');
    st = markSession(st, '2026-10-21', 'manana');
    st = markSession(st, '2026-10-21', 'noche');
    st = markSession(st, '2026-10-22', 'manana', { minutos: 7 });
    st = markSession(st, '2026-10-22', 'noche');
    st = markSession(st, '2026-10-23', 'manana');
    var e = getStats(st, '2026-10-23');
    eq('minutos totales', e.minutosTotales, 37);
    eq('sesiones hechas', e.sesionesHechas, 5);
    eq('sesiones posibles', e.sesionesPosibles, 5);
    eq('cumplimiento', e.cumplimiento, 1);
    eq('días completos', e.diasCompletos, 2);
    eq('racha con hoy en curso', e.rachaActual, 2);
    var e2 = getStats(st, '2026-10-24');
    eq('racha rota por día incompleto', e2.rachaActual, 0);
    eq('mejor racha', e2.mejorRacha, 2);
    eq('sesiones posibles día 4', e2.sesionesPosibles, 6);
    st = markSession(st, '2026-10-23', 'manana', { hecho: false });
    eq('desmarcar sesión', getLog(st, '2026-10-23').manana, { hecho: false, minutos: null });
    st = markSession(st, '2026-10-24', 'noche', { minutos: 2178 });
    var e3 = getStats(st, '2026-10-24');
    eq('hito de 36 h alcanzado', e3.hitos[0].alcanzado, true);
    eq('siguiente hito', e3.siguienteHito.horas, 50);
    st = markPhotos(st, 1, '2026-10-21');
    eq('fotos marcadas', getStats(st, '2026-10-24').fotosHechas, 1);
    st = updateSettings(st, { startDate: 'no-es-fecha', zonaPrioritaria: 'entradas' });
    eq('fecha inválida no cambia el inicio', st.settings.startDate, '2026-10-21');
    eq('zona prioritaria guardada', st.settings.zonaPrioritaria, 'entradas');
    var original = createInitialState('2026-10-21');
    markSession(original, '2026-10-21', 'manana');
    eq('las funciones no modifican el estado original', Object.keys(original.logs).length, 0);

    // Avisos
    var vacio = createInitialState('2026-10-21');
    eq('aviso de mañana', (getReminder(vacio, new Date(2026, 9, 21, 7, 30)) || {}).sesion, 'manana');
    eq('aviso de noche', (getReminder(vacio, new Date(2026, 9, 21, 20, 0)) || {}).sesion, 'noche');
    eq('sin aviso a media tarde', getReminder(vacio, new Date(2026, 9, 21, 15, 0)), null);

    // Temporizador con reloj simulado (fase 1, mañana: 60 s + 120 s + 120 s)
    var reloj = 0;
    var pasosAnunciados = [];
    var terminado = null;
    var timer = createGuidedTimer(getPlanForDate(S, '2026-10-21').manana.pasos, {
      now: function () { return reloj; },
      autoTick: false,
      onStep: function (p, i) { pasosAnunciados.push(i); },
      onFinish: function (snap) { terminado = snap; }
    });
    eq('total del temporizador', timer.totalSeg, 300);
    eq('inicio en paso 1', timer.start().indice, 0);
    reloj = 59500; eq('restan 1 s del paso 1', timer.tick().restanteSeg, 1);
    reloj = 60000; eq('cambia al paso 2', timer.tick().indice, 1);
    reloj = 100000; timer.pause();
    reloj = 200000; eq('pausado no avanza', timer.tick().transcurridoSeg, 100);
    timer.resume();
    reloj = 210000; eq('reanuda', timer.tick().transcurridoSeg, 110);
    eq('saltar al paso 3', timer.skip().indice, 2);
    reloj = 330000; timer.tick();
    eq('termina completo', terminado && terminado.completo, true);
    eq('pasos anunciados', pasosAnunciados, [0, 1, 2]);
    reloj = 0;
    var corto = createGuidedTimer([{ nombre: 'A', segundos: 120 }], { now: function () { return reloj; }, autoTick: false });
    corto.start();
    reloj = 90000;
    var fin = corto.finish();
    eq('terminar antes', [fin.estado, fin.completo, fin.transcurridoSeg], ['terminado', false, 90]);

    if (fallos.length) throw new Error('ScalpingHabit selfTest falló:\n- ' + fallos.join('\n- '));
    return 'ScalpingHabit selfTest OK (' + n + ' comprobaciones)';
  }

  /* ============================ 10. API pública ============================ */

  return {
    VERSION: VERSION,
    HABIT_ID: HABIT_ID,
    HABIT_NAME: HABIT_NAME,
    TOTAL_DAYS: TOTAL_DAYS,
    SESSIONS: SESSIONS,
    PHOTO_DAYS: PHOTO_DAYS,
    PHOTO_WINDOW: PHOTO_WINDOW,
    WEEKDAYS: WEEKDAYS,
    CONTENT: CONTENT,
    MOVEMENTS: MOVEMENTS,
    ZONES: ZONES,
    PRIORITY_ZONES: PRIORITY_ZONES,
    NIGHT_ZONE_BY_WEEKDAY: NIGHT_ZONE_BY_WEEKDAY,
    PHASES: PHASES,
    MAINTENANCE: MAINTENANCE,
    MILESTONES: MILESTONES,
    // Fechas
    toISODate: toISODate,
    todayISO: todayISO,
    isValidISO: isValidISO,
    addDays: addDays,
    daysBetween: daysBetween,
    getDayNumber: getDayNumber,
    getWeekday: getWeekday,
    formatFecha: formatFecha,
    formatHoras: formatHoras,
    // Plan
    getPhase: getPhase,
    getNightZone: getNightZone,
    getPlanForDate: getPlanForDate,
    getWeekPreview: getWeekPreview,
    getPhaseSummary: getPhaseSummary,
    getPlanMarkers: getPlanMarkers,
    getPlannedCumulativeMinutes: getPlannedCumulativeMinutes,
    plannedMinutesForDay: plannedMinutesForDay,
    getExpectation: getExpectation,
    getPhotoCheckpoint: getPhotoCheckpoint,
    getPhotoSchedule: getPhotoSchedule,
    // Estado
    createInitialState: createInitialState,
    normalizeState: normalizeState,
    getLog: getLog,
    markSession: markSession,
    setOil: setOil,
    setNote: setNote,
    markPhotos: markPhotos,
    updateSettings: updateSettings,
    // Estadísticas
    getStats: getStats,
    getHistory: getHistory,
    getReminder: getReminder,
    // Temporizador y navegador
    createGuidedTimer: createGuidedTimer,
    browser: browser,
    // Verificación
    selfTest: selfTest
  };
});
