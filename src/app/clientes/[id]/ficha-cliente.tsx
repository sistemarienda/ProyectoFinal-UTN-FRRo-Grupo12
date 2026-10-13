'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Horse, Student, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { desactivarCliente, modificarCliente, registrarConsentimiento, revocarConsentimiento } from '../acciones';
import { crearContrato, darDeBajaContrato, modificarContrato } from '../acciones-contrato';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { Modal } from '../../modal';
import { fechaCorta } from '@/lib/fechas';

type Salidas = inferRouterOutputs<RouterApp>;
type Ficha = Salidas['cliente']['ficha'];
type Servicio = Salidas['servicio']['listar'][number];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const ESTADO_CONTRATO_BADGE = { vigente: 'badge-ok', suspendido: 'badge-warn', finalizado: '' } as const;

function nombreCliente(cliente: Ficha['cliente']) {
  return cliente.tipo === 'persona_juridica'
    ? (cliente.razon_social ?? '')
    : `${cliente.persona?.apellido ?? ''}, ${cliente.persona?.nombre ?? ''}`;
}

export function FichaCliente({ ficha, servicios }: { ficha: Ficha; servicios: Servicio[] }) {
  const { cliente, contratos, caballos, alumnos } = ficha;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-fg">{nombreCliente(cliente)}</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              {cliente.tipo === 'persona_juridica' ? 'Persona jurídica' : 'Persona física'}
              {!cliente.activo && <span className="badge ml-2">Inactivo</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/cobranza/${cliente.id}`} className="btn btn-sec btn-sm">
              Cuenta corriente
            </Link>
            <Modal etiqueta="Editar" titulo={nombreCliente(cliente)} variante="sec" tamano="sm">
              <FormularioEditar cliente={cliente} />
            </Modal>
          </div>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="label">CUIT</dt>
            <dd className="tnum">{cliente.cuit ?? '—'}</dd>
          </div>
          <div>
            <dt className="label">Condición IVA</dt>
            <dd>{cliente.condicion_iva ?? '—'}</dd>
          </div>
          <div>
            <dt className="label">Canal preferido</dt>
            <dd>{cliente.canal_preferido === 'whatsapp' ? 'WhatsApp' : 'Correo'}</dd>
          </div>
          <div>
            <dt className="label">Día de vencimiento</dt>
            <dd className="tnum">{cliente.dia_vencimiento ?? 'Por omisión'}</dd>
          </div>
        </dl>

        <ConsentimientoWidget cliente={cliente} />
      </section>

      <SeccionContratos
        clienteId={cliente.id}
        contratos={contratos}
        servicios={servicios}
        caballos={caballos}
        alumnos={alumnos}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-serif text-lg text-fg">Caballos</h2>
          {caballos.length === 0 && <p className="mt-2 text-sm text-fg-muted">Sin caballos a pupilaje.</p>}
          <ul className="mt-2 space-y-1">
            {caballos.map((c) => (
              <li key={c.id}>
                <Link href={`/caballos/${c.id}`} className="flex items-center gap-2 rounded-lg p-2 -mx-2 text-sm hover:bg-hover-veil">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                    <Horse size={16} aria-hidden="true" />
                  </span>
                  <span className="font-medium text-fg">{c.nombre}</span>
                  <span className="text-xs text-fg-muted">{c.instalacion?.nombre ?? 'sin instalación'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-serif text-lg text-fg">Alumnos</h2>
          {alumnos.length === 0 && <p className="mt-2 text-sm text-fg-muted">Sin alumnos.</p>}
          <ul className="mt-2 space-y-2">
            {alumnos.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                  <Student size={16} aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-fg">{a.persona?.apellido}, {a.persona?.nombre}</span>
                {a.consentimiento_tutor_en ? (
                  <span className="badge badge-ok"><CheckCircle size={12} aria-hidden="true" />Consent. OK</span>
                ) : (
                  <span className="badge badge-bad"><WarningCircle size={12} aria-hidden="true" />Sin consent.</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Modal etiqueta="Desactivar cliente" titulo={`Desactivar a ${nombreCliente(cliente)}`}>
        <FormularioDesactivar clienteId={cliente.id} />
      </Modal>
    </div>
  );
}

function ConsentimientoWidget({ cliente }: { cliente: Ficha['cliente'] }) {
  const vigente = cliente.consentimiento_en && !cliente.consentimiento_revocado_en;
  const [resultadoReg, enviarReg] = useActionState(registrarConsentimiento, inicial);
  const [resultadoRev, enviarRev] = useActionState(revocarConsentimiento, inicial);

  return (
    <div className="card mt-4 p-3 text-sm">
      <p>
        Consentimiento de mensajería:{' '}
        {vigente ? (
          <span className="badge badge-ok"><CheckCircle size={12} aria-hidden="true" />otorgado el {cliente.consentimiento_en?.slice(0, 10)}</span>
        ) : (
          <span className="badge badge-bad"><WarningCircle size={12} aria-hidden="true" />no vigente</span>
        )}
      </p>
      {vigente ? (
        <form action={enviarRev} className="mt-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <BotonEnviar texto="Revocar" variante="sec" tamano="sm" />
          {resultadoRev.estado === 'error' && <p className="error">{resultadoRev.mensaje}</p>}
        </form>
      ) : (
        <form action={enviarReg} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <label className="block">
            <span className="label">Medio</span>
            <input name="medio" required placeholder="WhatsApp, verbal, formulario…" className="input" />
          </label>
          <BotonEnviar texto="Registrar consentimiento" variante="sec" tamano="sm" />
          {resultadoReg.estado === 'error' && <p className="error">{resultadoReg.mensaje}</p>}
        </form>
      )}
    </div>
  );
}

function FormularioEditar({ cliente }: { cliente: Ficha['cliente'] }) {
  const [resultado, enviar] = useActionState(modificarCliente, inicial);
  const [requiereFactura, setRequiereFactura] = useState(cliente.requiere_factura);

  return (
    <form action={enviar} className="card mt-3 max-w-xl space-y-4 p-4">
      <input type="hidden" name="clienteId" value={cliente.id} />
      {cliente.tipo === 'persona_juridica' && (
        <label className="block">
          <span className="label">Razón social</span>
          <input name="razonSocial" defaultValue={cliente.razon_social ?? ''} required className="input" />
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Canal preferido</span>
          <select name="canalPreferido" defaultValue={cliente.canal_preferido} className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Día de vencimiento pactado</span>
          <input
            name="diaVencimiento"
            type="number"
            min="1"
            max="28"
            defaultValue={cliente.dia_vencimiento ?? ''}
            className="input"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          name="requiereFactura"
          value="true"
          checked={requiereFactura}
          onChange={(e) => setRequiereFactura(e.target.checked)}
        />
        Pide factura
      </label>
      {requiereFactura && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">CUIT</span>
            <input name="cuit" defaultValue={cliente.cuit ?? ''} required className="input" />
          </label>
          <label className="block">
            <span className="label">Condición frente al IVA</span>
            <select name="condicionIva" defaultValue={cliente.condicion_iva ?? ''} required className="input">
              <option value="">Elegir…</option>
              <option value="responsable_inscripto">Responsable inscripto</option>
              <option value="monotributo">Monotributo</option>
              <option value="consumidor_final">Consumidor final</option>
              <option value="exento">Exento</option>
            </select>
          </label>
        </div>
      )}
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Guardado.</p>}
      <BotonEnviar texto="Guardar cambios" variante="sec" />
    </form>
  );
}

function FormularioDesactivar({ clienteId }: { clienteId: string }) {
  const [resultado, enviar] = useActionState(desactivarCliente, inicial);
  return (
    <form action={enviar} className="mt-2">
      <input type="hidden" name="clienteId" value={clienteId} />
      <p className="helper">El cliente queda inactivo y conserva su historial.</p>
      <div className="mt-2">
        <BotonEnviar texto="Confirmar baja" variante="sec" tamano="sm" />
      </div>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
    </form>
  );
}

function SeccionContratos({
  clienteId,
  contratos,
  servicios,
  caballos,
  alumnos,
}: {
  clienteId: string;
  contratos: Ficha['contratos'];
  servicios: Servicio[];
  caballos: Ficha['caballos'];
  alumnos: Ficha['alumnos'];
}) {
  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg text-fg">Contratos</h2>

      <div className="mt-3 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Contratos del cliente con su servicio, importe y estado.</caption>
          <thead>
            <tr>
              <th scope="col">Servicio</th>
              <th scope="col">Aplica a</th>
              <th scope="col">Desde</th>
              <th scope="col" className="num">Importe pactado</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {contratos.map((c) => (
              <FilaContrato key={c.id} contrato={c} clienteId={clienteId} />
            ))}
            {contratos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-fg-muted">Sin contratos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Modal etiqueta="Nuevo contrato" titulo="Nuevo contrato" variante="sec">
          <FormularioNuevoContrato
            clienteId={clienteId}
            servicios={servicios}
            caballos={caballos}
            alumnos={alumnos}
          />
        </Modal>
      </div>
    </section>
  );
}

function FilaContrato({ contrato: c, clienteId }: { contrato: Ficha['contratos'][number]; clienteId: string }) {
  const objeto = c.caballo ? c.caballo.nombre : c.alumno ? `${c.alumno.persona?.apellido}, ${c.alumno.persona?.nombre}` : '—';
  return (
    <tr className="align-top">
      <td className="font-medium">{c.servicio?.nombre}</td>
      <td>{objeto}</td>
      <td>{fechaCorta(c.fecha_inicio)}</td>
      <td className="num">{c.importe_pactado ? `$${Number(c.importe_pactado).toLocaleString('es-AR')}` : '—'}</td>
      <td>
        <span className={`badge ${ESTADO_CONTRATO_BADGE[c.estado]}`}>{c.estado}</span>
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={c.servicio?.nombre ?? 'Contrato'} tamano="sm">
            <FormularioEditarContrato contrato={c} clienteId={clienteId} />
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioEditarContrato({
  contrato: c,
  clienteId,
}: {
  contrato: Ficha['contratos'][number];
  clienteId: string;
}) {
  const [resultado, enviar] = useActionState(modificarContrato, inicial);
  const [resultadoBaja, enviarBaja] = useActionState(darDeBajaContrato, inicial);

  return (
    <div className="card mt-2 space-y-3 p-3">
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="contratoId" value={c.id} />
        <input type="hidden" name="clienteId" value={clienteId} />
        <label className="block">
          <span className="label">Estado</span>
          <select name="estado" defaultValue={c.estado ?? 'vigente'} className="input">
            <option value="vigente">Vigente</option>
            <option value="suspendido">Suspendido</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Importe pactado (vacío = tarifa vigente)</span>
          <input name="importePactado" type="number" min="0" step="0.01" defaultValue={c.importe_pactado ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="label">Fecha de fin</span>
          <input name="fechaFin" type="date" defaultValue={c.fecha_fin ?? ''} className="input" />
        </label>
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        <BotonEnviar texto="Guardar" variante="sec" tamano="sm" />
      </form>
      <form action={enviarBaja}>
        <input type="hidden" name="contratoId" value={c.id} />
        <input type="hidden" name="clienteId" value={clienteId} />
        <button type="submit" className="btn btn-gho btn-sm text-bad">Dar de baja ahora</button>
        {resultadoBaja.estado === 'error' && <p className="error">{resultadoBaja.mensaje}</p>}
      </form>
    </div>
  );
}

function FormularioNuevoContrato({
  clienteId,
  servicios,
  caballos,
  alumnos,
}: {
  clienteId: string;
  servicios: Servicio[];
  caballos: Ficha['caballos'];
  alumnos: Ficha['alumnos'];
}) {
  const [resultado, enviar] = useActionState(crearContrato, inicial);
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? '');
  const servicio = servicios.find((s) => s.id === servicioId);

  return (
    <form action={enviar} className="card mt-2 space-y-4 p-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <label className="block">
        <span className="label">Servicio</span>
        <select
          name="servicioId"
          value={servicioId}
          onChange={(e) => setServicioId(e.target.value)}
          className="input"
        >
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      {servicio?.aplicaA === 'caballo' ? (
        <label className="block">
          <span className="label">Caballo</span>
          <select name="caballoId" required className="input">
            <option value="">Elegir…</option>
            {caballos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className="label">Alumno</span>
          <select name="alumnoId" required className="input">
            <option value="">Elegir…</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.persona?.apellido}, {a.persona?.nombre}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Fecha de inicio</span>
          <input name="fechaInicio" type="date" required className="input" />
        </label>
        <label className="block">
          <span className="label">Importe pactado (opcional; pisa la tarifa)</span>
          <input name="importePactado" type="number" min="0" step="0.01" className="input" />
        </label>
      </div>

      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Contrato creado.</p>}
      <BotonEnviar texto="Crear contrato" variante="sec" />
    </form>
  );
}
