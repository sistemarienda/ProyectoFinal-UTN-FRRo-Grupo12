'use client';

import { useActionState, useState } from 'react';
import { WhatsappLogo, Envelope } from '@phosphor-icons/react';
import { crearPlantilla, modificarPlantilla, registrarRevisionMeta } from './acciones-plantillas';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';
import { Modal } from '../modal';

export interface PlantillaVisible {
  id: string;
  codigo: string;
  canal: 'whatsapp' | 'email';
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
  nombreMeta: string | null;
  categoria: 'utility' | 'marketing' | null;
  estadoAprobacion: 'borrador' | 'en_revision' | 'aprobada' | 'rechazada' | 'pausada';
  motivoRechazo: string | null;
  firmanteOrigen: 'responsable_cobranza' | 'instructor_clase' | 'quien_envia';
}

const ESTADO_BADGE = {
  borrador: '',
  en_revision: 'badge-warn',
  aprobada: 'badge-ok',
  rechazada: 'badge-bad',
  pausada: 'badge-warn',
} as const;
const ESTADO_TEXTO = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  pausada: 'Pausada',
} as const;
const FIRMANTE_TEXTO = {
  responsable_cobranza: 'Responsable de cobranza',
  instructor_clase: 'Instructor de la clase',
  quien_envia: 'Quien envía',
} as const;

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const LIMITE_CUERPO_WHATSAPP = 1024;

export function SeccionPlantillas({ plantillas }: { plantillas: PlantillaVisible[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <h2 className="font-serif text-lg text-fg">Plantillas de mensajes</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Textos que se envían por WhatsApp y por correo. WhatsApp requiere la aprobación de Meta
          para cada plantilla antes de habilitar su envío.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="tbl min-w-[600px]">
          <caption className="sr-only">Plantillas con su canal, estado de aprobación y firmante.</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Canal</th>
              <th scope="col">Firmante</th>
              <th scope="col">Estado</th>
              <th scope="col">Activa</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {plantillas.map((p) => (
              <FilaPlantilla key={p.id} plantilla={p} />
            ))}
            {plantillas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-fg-muted">
                  No hay plantillas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-surface-border p-5">
        <FormularioNuevaPlantilla />
      </div>
    </section>
  );
}

function FilaPlantilla({ plantilla: p }: { plantilla: PlantillaVisible }) {
  return (
    <tr className={p.activa ? '' : 'text-fg-muted'}>
      <td className="font-medium">
        <code>{p.codigo}</code>
      </td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-xs">
          {p.canal === 'whatsapp' ? <WhatsappLogo size={14} aria-hidden="true" /> : <Envelope size={14} aria-hidden="true" />}
          {p.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}
        </span>
      </td>
      <td className="text-xs">{FIRMANTE_TEXTO[p.firmanteOrigen]}</td>
      <td>
        <span className={`badge ${ESTADO_BADGE[p.estadoAprobacion]}`}>{ESTADO_TEXTO[p.estadoAprobacion]}</span>
      </td>
      <td>
        <span className={`badge ${p.activa ? 'badge-ok' : ''}`}>{p.activa ? 'Sí' : 'No'}</span>
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={p.codigo} tamano="sm">
            <FormularioEditarPlantilla plantilla={p} />
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioEditarPlantilla({ plantilla: p }: { plantilla: PlantillaVisible }) {
  const [resultado, enviar] = useActionState(modificarPlantilla, inicial);
  const [cuerpo, setCuerpo] = useState(p.cuerpo);
  const [resultadoRevision, enviarRevision] = useActionState(registrarRevisionMeta, inicial);

  return (
    <div className="card mt-2 space-y-4 p-4">
      <form action={enviar} className="space-y-3">
        <input type="hidden" name="plantillaId" value={p.id} />
        {p.canal === 'email' && (
          <label className="block">
            <span className="label">Asunto</span>
            <input name="asunto" defaultValue={p.asunto ?? ''} className="input" />
          </label>
        )}
        <label className="block">
          <span className="label">Cuerpo</span>
          <textarea
            name="cuerpo"
            rows={4}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            className="input"
          />
          {p.canal === 'whatsapp' && (
            <p className={`helper ${cuerpo.length > LIMITE_CUERPO_WHATSAPP ? 'text-bad' : ''}`}>
              {cuerpo.length} / {LIMITE_CUERPO_WHATSAPP} caracteres
            </p>
          )}
        </label>
        <label className="block">
          <span className="label">Firmante</span>
          <select name="firmanteOrigen" defaultValue={p.firmanteOrigen} className="input">
            <option value="quien_envia">Quien envía</option>
            <option value="responsable_cobranza">Responsable de cobranza</option>
            <option value="instructor_clase">Instructor de la clase</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="activa" value="true" defaultChecked={p.activa} />
          Activa
        </label>
        <p className="helper">Al guardar, la plantilla vuelve a estado borrador y requiere nueva aprobación de Meta.</p>
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok">Guardado.</p>}
        <BotonEnviar texto="Guardar" variante="sec" tamano="sm" />
      </form>

      {p.canal === 'whatsapp' && (
        <form action={enviarRevision} className="space-y-3 border-t border-surface-border pt-4">
          <input type="hidden" name="plantillaId" value={p.id} />
          <p className="label">Registrar revisión de Meta</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Resultado</span>
              <select name="estadoAprobacion" defaultValue={p.estadoAprobacion} className="input">
                <option value="en_revision">En revisión</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="pausada">Pausada</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Nombre en Meta</span>
              <input name="nombreMeta" defaultValue={p.nombreMeta ?? ''} className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Motivo del rechazo (si aplica)</span>
            <input name="motivoRechazo" defaultValue={p.motivoRechazo ?? ''} className="input" />
          </label>
          {resultadoRevision.estado === 'error' && <p className="error">{resultadoRevision.mensaje}</p>}
          <BotonEnviar texto="Registrar" variante="sec" tamano="sm" />
        </form>
      )}
    </div>
  );
}

function FormularioNuevaPlantilla() {
  const [resultado, enviar] = useActionState(crearPlantilla, inicial);
  const [canal, setCanal] = useState<'whatsapp' | 'email'>('whatsapp');
  const [cuerpo, setCuerpo] = useState('');

  return (
    <form action={enviar} className="card space-y-4 p-4">
      <h3 className="text-sm font-medium text-fg">Nueva plantilla</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Código</span>
          <input name="codigo" required placeholder="aviso_previo_vencimiento" className="input" />
        </label>
        <label className="block">
          <span className="label">Canal</span>
          <select name="canal" value={canal} onChange={(e) => setCanal(e.target.value as 'whatsapp' | 'email')} className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
          </select>
        </label>
      </div>
      {canal === 'email' && (
        <label className="block">
          <span className="label">Asunto</span>
          <input name="asunto" className="input" />
        </label>
      )}
      <label className="block">
        <span className="label">Cuerpo</span>
        <textarea name="cuerpo" rows={4} required value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} className="input" />
        {canal === 'whatsapp' && (
          <p className={`helper ${cuerpo.length > LIMITE_CUERPO_WHATSAPP ? 'text-bad' : ''}`}>
            {cuerpo.length} / {LIMITE_CUERPO_WHATSAPP} caracteres
          </p>
        )}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Categoría (WhatsApp)</span>
          <select name="categoria" defaultValue="" className="input">
            <option value="">No aplica</option>
            <option value="utility">Utility</option>
            <option value="marketing">Marketing</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Firmante</span>
          <select name="firmanteOrigen" defaultValue="quien_envia" className="input">
            <option value="quien_envia">Quien envía</option>
            <option value="responsable_cobranza">Responsable de cobranza</option>
            <option value="instructor_clase">Instructor de la clase</option>
          </select>
        </label>
      </div>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Plantilla creada.</p>}
      <BotonEnviar texto="Crear plantilla" variante="sec" />
    </form>
  );
}
