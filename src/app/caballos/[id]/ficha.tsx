'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Horse } from '@phosphor-icons/react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { darDeBajaCaballo, modificarCaballo } from '../acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { edadEn } from '@/lib/personas';
import { BotonEnviar } from '../../botones';
import { Modal } from '../../modal';
import { fechaCorta } from '@/lib/fechas';

type Salidas = inferRouterOutputs<RouterApp>;
type Ficha = Salidas['caballo']['ficha'];
type Opcion = { id: string; nombre: string | null };

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const ESTADOS = { activo: 'Activo', en_tratamiento: 'En tratamiento', retirado: 'Retirado' } as const;
const ESTADO_BADGE = { activo: 'badge-ok', en_tratamiento: 'badge-warn', retirado: '' } as const;

export function FichaDeCaballo({
  ficha,
  propietarios,
  instalaciones,
}: {
  ficha: Ficha;
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const { caballo, contratos } = ficha;
  const nombrePropietario =
    caballo.propietario?.tipo === 'persona_juridica'
      ? caballo.propietario.razon_social
      : caballo.propietario?.persona
        ? `${caballo.propietario.persona.apellido}, ${caballo.propietario.persona.nombre}`
        : null;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
              <Horse size={22} aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-serif text-2xl text-fg">{caballo.nombre}</h1>
              <p className="mt-0.5 text-sm text-fg-muted">{caballo.instalacion?.nombre ?? 'Sin instalación asignada'}</p>
              <span className={`badge mt-1.5 ${ESTADO_BADGE[caballo.estado]}`}>{ESTADOS[caballo.estado]}</span>
            </div>
          </div>
          <Modal etiqueta="Editar" titulo={caballo.nombre} variante="sec" tamano="sm">
            <FormularioEditar caballo={caballo} propietarios={propietarios} instalaciones={instalaciones} />
          </Modal>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="label">Raza</dt><dd>{caballo.raza ?? '—'}</dd></div>
          <div><dt className="label">Sexo</dt><dd>{caballo.sexo ?? '—'}</dd></div>
          <div>
            <dt className="label">Edad</dt>
            <dd className="tnum">{caballo.fecha_nacimiento ? `${edadEn(caballo.fecha_nacimiento)} años` : '—'}</dd>
          </div>
          <div><dt className="label">Pelaje</dt><dd>{caballo.pelaje ?? '—'}</dd></div>
          <div><dt className="label">Peso</dt><dd className="tnum">{caballo.peso_kg ? `${caballo.peso_kg} kg` : '—'}</dd></div>
          <div>
            <dt className="label">Propietario</dt>
            <dd>
              {caballo.propietario ? (
                <Link href={`/clientes/${caballo.propietario.id}`} className="link">
                  {nombrePropietario}
                </Link>
              ) : (
                'Del haras'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-lg text-fg">Contratos</h2>
        <p className="mt-1 text-xs text-fg-muted">Se dan de alta desde la ficha del cliente propietario.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Contratos de este caballo con su servicio, importe y estado.</caption>
            <thead>
              <tr>
                <th scope="col">Servicio</th>
                <th scope="col">Desde</th>
                <th scope="col" className="num">Importe</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {contratos.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.servicio?.nombre}</td>
                  <td>{fechaCorta(c.fecha_inicio)}</td>
                  <td className="num">{c.importe_pactado ? `$${Number(c.importe_pactado).toLocaleString('es-AR')}` : '—'}</td>
                  <td><span className="badge badge-accent">{c.estado}</span></td>
                </tr>
              ))}
              {contratos.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-fg-muted">Sin contratos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {caballo.estado !== 'retirado' && (
        <Modal etiqueta="Dar de baja" titulo={`Dar de baja a ${caballo.nombre}`}>
          <FormularioBaja caballoId={caballo.id} />
        </Modal>
      )}
    </div>
  );
}

function FormularioEditar({
  caballo,
  propietarios,
  instalaciones,
}: {
  caballo: Ficha['caballo'];
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const [resultado, enviar] = useActionState(modificarCaballo, inicial);
  return (
    <form action={enviar} className="card mt-3 max-w-xl space-y-4 p-4">
      <input type="hidden" name="caballoId" value={caballo.id} />
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" defaultValue={caballo.nombre} required className="input" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Propietario</span>
          <select name="propietarioId" defaultValue={caballo.propietario?.id ?? ''} className="input">
            <option value="">Del haras</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Instalación</span>
          <select name="instalacionId" defaultValue={caballo.instalacion?.id ?? ''} className="input">
            <option value="">Sin asignar</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Raza</span>
          <input name="raza" defaultValue={caballo.raza ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="label">Sexo</span>
          <select name="sexo" defaultValue={caballo.sexo ?? ''} className="input">
            <option value="">Sin especificar</option>
            <option value="macho">Macho</option>
            <option value="macho_castrado">Macho castrado</option>
            <option value="hembra">Hembra</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Pelaje</span>
          <input name="pelaje" defaultValue={caballo.pelaje ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="label">Peso (kg)</span>
          <input name="pesoKg" type="number" min="0" step="0.1" defaultValue={caballo.peso_kg ?? ''} className="input" />
        </label>
        <label className="block">
          <span className="label">Estado</span>
          <select name="estado" defaultValue={caballo.estado} className="input">
            <option value="activo">Activo</option>
            <option value="en_tratamiento">En tratamiento</option>
            <option value="retirado">Retirado</option>
          </select>
        </label>
      </div>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Guardado.</p>}
      <BotonEnviar texto="Guardar cambios" variante="sec" />
    </form>
  );
}

function FormularioBaja({ caballoId }: { caballoId: string }) {
  const [resultado, enviar] = useActionState(darDeBajaCaballo, inicial);
  return (
    <form action={enviar} className="mt-2">
      <input type="hidden" name="caballoId" value={caballoId} />
      <BotonEnviar texto="Confirmar baja" variante="sec" />
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
    </form>
  );
}
