'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { desactivarAlumno, modificarAlumno } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { edadEn } from '@/lib/personas';
import { BotonEnviar } from '../botones';
import { Modal } from '../modal';
import { fechaCorta } from '@/lib/fechas';

type Alumno = inferRouterOutputs<RouterApp>['alumno']['listar'][number];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

const NIVELES = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

export function FilaAlumno({ alumno: a }: { alumno: Alumno }) {
  const edad = a.persona?.fecha_nacimiento ? edadEn(a.persona.fecha_nacimiento) : null;
  const nombreCliente =
    a.cliente?.tipo === 'persona_juridica'
      ? a.cliente.razon_social
      : `${a.cliente?.persona?.apellido ?? ''}, ${a.cliente?.persona?.nombre ?? ''}`;

  return (
    <tr className={`align-top ${a.activo ? '' : 'text-fg-muted'}`}>
      <td className="font-medium">{a.persona?.apellido}, {a.persona?.nombre}</td>
      <td className="num">{edad ?? '—'}</td>
      <td>{a.nivel ? <span className="badge">{NIVELES[a.nivel]}</span> : '—'}</td>
      <td className="text-sm">{a.responsable ? `${a.responsable.apellido}, ${a.responsable.nombre}` : 'No aplica · mayor'}</td>
      <td>
        {a.cliente && <Link href={`/clientes/${a.cliente.id}`} className="link text-sm">{nombreCliente}</Link>}
      </td>
      <td>
        {a.consentimiento_tutor_en ? (
          <span className="badge badge-ok"><CheckCircle size={13} aria-hidden="true" />Consent. {fechaCorta(a.consentimiento_tutor_en)}</span>
        ) : edad !== null && edad < 18 ? (
          <span className="badge badge-bad"><WarningCircle size={13} aria-hidden="true" />Sin consentimiento</span>
        ) : (
          <span className="badge">No requiere</span>
        )}
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={`${a.persona?.apellido}, ${a.persona?.nombre}`} tamano="sm">
            <FormularioEditar alumno={a} />
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioEditar({ alumno: a }: { alumno: Alumno }) {
  const [resultado, enviar] = useActionState(modificarAlumno, inicial);
  const [resultadoBaja, enviarBaja] = useActionState(desactivarAlumno, inicial);

  return (
    <div className="space-y-3">
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="alumnoId" value={a.id} />
        <input type="hidden" name="responsableId" value={a.responsable?.id ?? ''} />
        <div>
          <label className="label" htmlFor={`nivel-${a.id}`}>Nivel</label>
          <select id={`nivel-${a.id}`} name="nivel" defaultValue={a.nivel ?? ''} className="input">
            <option value="">Sin asignar</option>
            <option value="inicial">Inicial</option>
            <option value="nivel_1">Nivel 1</option>
            <option value="nivel_2">Nivel 2</option>
            <option value="nivel_3">Nivel 3</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`consentimiento-${a.id}`}>Consentimiento del tutor otorgado el</label>
          <input
            id={`consentimiento-${a.id}`}
            name="consentimientoTutorEn"
            type="date"
            defaultValue={a.consentimiento_tutor_en?.slice(0, 10) ?? ''}
            className="input"
          />
        </div>
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        <BotonEnviar texto="Guardar" variante="sec" tamano="sm" />
      </form>
      {a.activo && (
        <form action={enviarBaja}>
          <input type="hidden" name="alumnoId" value={a.id} />
          <button type="submit" className="btn btn-gho btn-sm text-bad">Desactivar</button>
          {resultadoBaja.estado === 'error' && <p className="error">{resultadoBaja.mensaje}</p>}
        </form>
      )}
    </div>
  );
}
