'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { type FilaDeCuidado, filasDeFormulario } from '@/lib/bienestar';

/**
 * Registrar una tanda de cuidados tiene un final que el `ResultadoDeGuardado`
 * común no sabe contar: cuántos entraron y cuántos ya estaban.
 *
 * «Ya estaba» no es un error ni una advertencia: es la idempotencia de la
 * decisión 1.6 funcionando. Si el peón toca guardar dos veces, o si M14
 * reintenta la cola, la segunda vuelta no duplica nada y el sistema lo dice en
 * lugar de fingir que registró el doble.
 */
export type ResultadoDeTanda =
  | { estado: 'inicial' }
  | { estado: 'ok'; registrados: number; repetidos: number }
  | { estado: 'error'; mensaje: string };

function refrescarCampo() {
  revalidatePath('/campo/hoy');
  revalidatePath('/campo/alimentacion');
  revalidatePath('/campo/higiene');
  revalidatePath('/sanidad');
}

export async function registrarAlimentacion(
  _previo: ResultadoDeTanda,
  datos: FormData,
): Promise<ResultadoDeTanda> {
  const registros = filasDeFormulario(datos);
  if (registros.length === 0) {
    return { estado: 'error', mensaje: 'No hay ningún caballo marcado.' };
  }

  try {
    const sinCaballo = registros.some((r) => r.caballoId === null);
    if (sinCaballo) return { estado: 'error', mensaje: 'Hay una fila sin caballo.' };

    const api = await llamador();
    const r = await api.registroCuidado.registrarAlimentacion({
      registros: registros.map((fila) => ({ ...fila, caballoId: fila.caballoId! })),
    });
    refrescarCampo();
    return { estado: 'ok', registrados: r.registrados, repetidos: r.repetidos };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la alimentación.' };
  }
}

export async function registrarHigiene(
  _previo: ResultadoDeTanda,
  datos: FormData,
): Promise<ResultadoDeTanda> {
  const registros = filasDeFormulario(datos);
  if (registros.length === 0) {
    return { estado: 'error', mensaje: 'No hay ningún box marcado.' };
  }

  // El box desocupado se registra contra la instalación solamente (CUS03,
  // camino 2.a): el caballo va nulo y la instalación es la que no puede faltar.
  const conInstalacion = registros.filter((r) => r.instalacionId !== null);
  if (conInstalacion.length !== registros.length) {
    return { estado: 'error', mensaje: 'Hay un box sin identificar en la planilla.' };
  }

  try {
    const api = await llamador();
    const r = await api.registroCuidado.registrarHigiene({
      registros: conInstalacion.map((fila) => ({ ...fila, instalacionId: fila.instalacionId! })),
    });

    refrescarCampo();
    return { estado: 'ok', registrados: r.registrados, repetidos: r.repetidos };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la higiene.' };
  }
}

/** Lo que llega de `offline-db` a sincronizar: la fila más el tipo de planilla que la encoló. */
export interface PendienteASincronizar extends FilaDeCuidado {
  claveDeCola: string;
  tipo: 'alimentacion' | 'higiene';
}

export interface ResultadoDeSincronizacion {
  sincronizadas: string[]; // claveDeCola de lo que ya se puede quitar de la cola
  fallidas: { claveDeCola: string; mensaje: string }[];
}

/**
 * M14 · Vacía la cola offline contra los mismos procedimientos que usa el
 * envío en línea.
 *
 * Se agrupa por tipo porque `registrarAlimentacion`/`registrarHigiene` reciben
 * la tanda entera de una vez, y se agrupa **todo o nada por grupo**: si un
 * `insert` de varias filas fallara a mitad de camino dejaría algunas filas
 * escritas y otras no sin forma de saber cuáles, así que ante un error se
 * marca fallido el grupo completo para reintentarlo entero en la próxima
 * vuelta, en lugar de arriesgar un estado a medias que nadie audita.
 */
export async function sincronizarPendientes(
  pendientes: readonly PendienteASincronizar[],
): Promise<ResultadoDeSincronizacion> {
  const sincronizadas: string[] = [];
  const fallidas: { claveDeCola: string; mensaje: string }[] = [];

  const deAlimentacion = pendientes.filter((p) => p.tipo === 'alimentacion');
  const deHigiene = pendientes.filter((p) => p.tipo === 'higiene');

  if (deAlimentacion.length > 0) {
    try {
      const api = await llamador();
      await api.registroCuidado.registrarAlimentacion({
        registros: deAlimentacion.map((p) => ({ ...p, caballoId: p.caballoId! })),
      });
      sincronizadas.push(...deAlimentacion.map((p) => p.claveDeCola));
    } catch (e) {
      const mensaje = e instanceof TRPCError ? e.message : 'No se pudo sincronizar la alimentación.';
      fallidas.push(...deAlimentacion.map((p) => ({ claveDeCola: p.claveDeCola, mensaje })));
    }
  }

  if (deHigiene.length > 0) {
    try {
      const api = await llamador();
      await api.registroCuidado.registrarHigiene({
        registros: deHigiene.map((p) => ({ ...p, instalacionId: p.instalacionId! })),
      });
      sincronizadas.push(...deHigiene.map((p) => p.claveDeCola));
    } catch (e) {
      const mensaje = e instanceof TRPCError ? e.message : 'No se pudo sincronizar la higiene.';
      fallidas.push(...deHigiene.map((p) => ({ claveDeCola: p.claveDeCola, mensaje })));
    }
  }

  if (sincronizadas.length > 0) refrescarCampo();
  return { sincronizadas, fallidas };
}
