'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CreditCard } from '@phosphor-icons/react';
import { pagarConMercadoPago, type ResultadoDePago } from './acciones';

const inicial: ResultadoDePago = { estado: 'inicial' };

function Boton({ deshabilitado }: { deshabilitado?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={deshabilitado || pending} className="btn btn-pri btn-lg w-full">
      <CreditCard aria-hidden="true" />
      {pending ? 'Generando el enlace…' : 'Pagar con MercadoPago'}
    </button>
  );
}

export function BotonPagar({ deshabilitado }: { deshabilitado?: boolean }) {
  const [resultado, enviar] = useActionState(pagarConMercadoPago, inicial);

  return (
    <form action={enviar}>
      <Boton deshabilitado={deshabilitado} />
      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
    </form>
  );
}
