-- QA del portal (M13): la ficha del caballo promete «cambio en el plan
-- alimentario» entre las novedades (04-wireframes.md § 7.2), pero
-- `plan_lectura` sólo dejaba entrar a `es_personal()`. El cliente pedía la
-- tabla, RLS la filtraba entera y la pantalla mostraba la novedad sanitaria
-- sola, sin avisar de nada: mismo criterio que `sanitario_lectura`.
create policy plan_lectura_del_cliente on plan_alimentario for select to authenticated
  using (
    exists (select 1 from caballo c
              where c.id = plan_alimentario.caballo_id
                and c.propietario_id in (select clientes_del_usuario()))
  );
