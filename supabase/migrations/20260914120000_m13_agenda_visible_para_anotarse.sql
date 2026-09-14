-- Auditoría de cierre de sesión (M13): `clase_lectura` sólo dejaba ver una
-- clase al cliente si YA tenía una inscripción en ella. La pantalla de
-- «cupo libre para anotarse» (`portal.agenda`, sección «abiertas») nunca
-- podía mostrar una clase nueva: RLS la filtraba antes de que el router la
-- viera. Mismo criterio que `evento_lectura` ya usa para `evento`: una
-- clase programada no es un dato sensible —quién está anotado sí lo es, y
-- sigue protegido por `inscripcion_lectura`—, así que se abre por estado.
create policy clase_lectura_programada on clase for select to authenticated
  using (estado = 'programada');

-- Y el mismo patrón de conteo que `ocupacion_evento`: `inscripcion_lectura`
-- también está scoped a lo propio, así que ni la pantalla del portal ni la
-- verificación de cupo del lado del servidor (`inscripcion.inscribirPropio`,
-- que comparte núcleo con `inscribir`) podían contar los inscriptos de las
-- demás familias. Sin esto, el control de cupo para un cliente era falso:
-- podía inscribirse en una clase llena porque sólo veía sus propias filas.
create or replace function inscriptos_de_clase(p_clase uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from inscripcion where clase_id = p_clase and estado = 'inscripto';
$$;
