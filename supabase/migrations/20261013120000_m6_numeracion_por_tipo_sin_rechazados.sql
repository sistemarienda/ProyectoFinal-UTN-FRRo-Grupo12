-- M6 · La numeración única de comprobantes, como la lleva ARCA.
--
-- La restricción original era `unique (punto_venta_id, numero)`, y tenía dos
-- defectos que aparecieron en la QA del 13/10/2026:
--
--   1. No incluía el tipo. ARCA numera por punto de venta Y tipo de
--      comprobante: la factura C 0001-00000001 y la nota de crédito C
--      0001-00000001 conviven. La primera nota de crédito iba a chocar.
--   2. Contaba los rechazados. Un rechazo no consume número en ARCA, así que
--      el reintento recibe el mismo; la base lo rechazaba DESPUÉS de que ARCA lo
--      había autorizado, y quedaba una factura válida que RIENDA no registraba
--      (el estado inconsistente de R-06).
--
-- Los rechazados conservan su número como dato del intento, pero no lo reservan.

alter table comprobante drop constraint comprobante_numero_unico;

create unique index comprobante_numero_unico
  on comprobante (punto_venta_id, tipo, numero)
  where estado <> 'rechazado';
