-- M13 · Portal del cliente.
--
-- El resto del acceso del cliente ya estaba anticipado en 0003 (`clientes_del_usuario`,
-- lectura de sus caballos, sus clases, su cuenta, `inscripcion_del_cliente` e
-- `inscripcion_evento_del_cliente`). Faltaban dos escrituras propias:
--
--   1. Cancelar la propia inscripción: sólo había política de INSERT, no de UPDATE.
--   2. Generar su propio enlace de pago: `pago` era enteramente del administrador.
--      Sin esto el cliente no podría ni crear el registro `pendiente` que
--      `pago.pagarPropio` necesita antes de pedirle la preferencia a MercadoPago.

-- El cliente cancela una inscripción propia (de un alumno suyo), nunca la de otro.
-- No hay control de columna aparte: como en `cuidado_propio`, lo que puede escribir
-- una mutación de este rol lo acota el router (`inscripcion.cancelarPropio`), no RLS.
create policy inscripcion_cancelacion_del_cliente on inscripcion for update to authenticated
  using (exists (select 1 from alumno a where a.id = inscripcion.alumno_id
                  and a.cliente_id in (select clientes_del_usuario())))
  with check (exists (select 1 from alumno a where a.id = inscripcion.alumno_id
                  and a.cliente_id in (select clientes_del_usuario())));

-- El cliente sólo puede dejar un pago propio, pendiente y por MercadoPago: nunca
-- puede acreditarse un pago a mano ni declarar otro medio. Acreditar sigue siendo
-- exclusivo del administrador o del webhook de MercadoPago (`pago_escritura`).
create policy pago_del_cliente on pago for insert to authenticated
  with check (
    cliente_id in (select clientes_del_usuario())
    and medio = 'mercadopago'
    and estado = 'pendiente'
  );
