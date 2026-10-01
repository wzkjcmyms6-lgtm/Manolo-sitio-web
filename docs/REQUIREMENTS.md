# Requisitos (prompt maestro, 1 oct 2026)

Resumen operativo. Prioridad: preservar lo que funciona (Ejercicio,
Finanzas, Hábitos) y evolucionar por fases validadas.

| # | Requisito | Fase |
|---|---|---|
| R1 | Contraseña del login con teclado numérico en móviles (sin perder ocultación, autocompletado ni validación) | 1 |
| R2 | Nota/descripción opcional por hábito (crear, editar, ver; compatible con hábitos viejos) | 1 |
| R3 | Evento de inicio de sesión real → registro persistente → notificación al administrador; historial, leído/no leído; solo admin (protegido en reglas, no solo en la interfaz); sin duplicados ni datos sensibles | 1 |
| R4 | Motor de actividades reutilizable (Running, Bicicleta, futuras) | 2 |
| R5 | Running: quitar versículo; pantalla previa (rutina / libre, estado del GPS); GPS con filtrado; métricas (distancia, tiempos, ritmo, velocidad, parciales, ruta, desnivel si hay); pantalla activa legible; pausar/reanudar/finalizar; resumen; guardado — **GPS retirado a pedido del dueño (D-033)** | 3 |
| R6 | Rutinas de Running por CSV (formato documentado, validación, vista previa, guardar, elegir, ejecutar) | 4 |
| R7 | Ejecutor de intervalos con avisos visuales, sonido y voz local; separado del GPS; recuperación tras cierre | 4 |
| R8 | Bicicleta con el mismo motor; prioriza velocidad | 5 |
| R9 | Historial y análisis deportivo (detalle, mapa, parciales, tendencias) — hoy: resumen semanal de km y tiempo, 12 semanas (D-035) | 6 |
| R12 | Running y Bici sin GPS; resumen semanal tipo Strava (km y tiempo, sin desnivel); rutinas CSV de varios días como cola (la completada al final); historial que no se borra con las rutinas | 2026-10-01 |
| R10 | Optimización (batería, consultas, almacenamiento, costos) | 7 |
| R11 | QA final y regresión de todo MANOLO | 8 |

Transversales: no copiar Strava (solo referencia de UX), mantener identidad
visual de MANOLO, no inventar capacidades del dispositivo, mínimo consumo de
nube/tokens, documentar decisiones, checkpoint al final de cada fase.
