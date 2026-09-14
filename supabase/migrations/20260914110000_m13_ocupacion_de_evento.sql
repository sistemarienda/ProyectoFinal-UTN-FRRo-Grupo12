-- QA del portal (M13): `inscripcion_evento_lectura` sólo deja ver al cliente
-- sus propias inscripciones ("cliente_id in clientes_del_usuario()"), así que
-- ni la pantalla podía contar cuántos lugares quedaban ni `portal.inscribirEvento`
-- podía verificar el cupo de verdad: las inscripciones de las demás familias
-- eran invisibles para esa cuenta, y la pantalla mostraba el cupo siempre
-- entero. El total ocupado no es un dato sensible —quién se anotó sí lo es, y
-- sigue protegido por RLS—, así que se resuelve con una función que cuenta sin
-- pasar por esa política, mismo criterio que `tiene_contrato_vigente`.
create or replace function ocupacion_evento(p_evento uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from inscripcion_evento
   where evento_id = p_evento and estado = 'inscripto';
$$;
