export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alumno: {
        Row: {
          activo: boolean
          actualizado_en: string
          cliente_id: string
          consentimiento_tutor_en: string | null
          creado_en: string
          id: string
          nivel: Database["public"]["Enums"]["nivel_alumno"] | null
          observaciones_medicas: string | null
          persona_id: string
          responsable_id: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          cliente_id: string
          consentimiento_tutor_en?: string | null
          creado_en?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          observaciones_medicas?: string | null
          persona_id: string
          responsable_id?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          cliente_id?: string
          consentimiento_tutor_en?: string | null
          creado_en?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          observaciones_medicas?: string | null
          persona_id?: string
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumno_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumno_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumno_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
      arca_ticket: {
        Row: {
          actualizado_en: string
          credenciales: Json
          servicio: string
        }
        Insert: {
          actualizado_en?: string
          credenciales: Json
          servicio: string
        }
        Update: {
          actualizado_en?: string
          credenciales?: Json
          servicio?: string
        }
        Relationships: []
      }
      asistencia: {
        Row: {
          actualizado_en: string
          alumno_id: string
          caballo_id: string | null
          clase_id: string
          creado_en: string
          id: string
          observaciones: string | null
          presente: boolean
          registrado_por: string
        }
        Insert: {
          actualizado_en?: string
          alumno_id: string
          caballo_id?: string | null
          clase_id: string
          creado_en?: string
          id?: string
          observaciones?: string | null
          presente: boolean
          registrado_por?: string
        }
        Update: {
          actualizado_en?: string
          alumno_id?: string
          caballo_id?: string | null
          clase_id?: string
          creado_en?: string
          id?: string
          observaciones?: string | null
          presente?: boolean
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno_sin_datos_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencia_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: Database["public"]["Enums"]["accion_auditoria"]
          datos_previos: Json | null
          entidad: string
          entidad_id: string | null
          id: number
          ocurrido_en: string
          usuario_id: string | null
        }
        Insert: {
          accion: Database["public"]["Enums"]["accion_auditoria"]
          datos_previos?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: number
          ocurrido_en?: string
          usuario_id?: string | null
        }
        Update: {
          accion?: Database["public"]["Enums"]["accion_auditoria"]
          datos_previos?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: number
          ocurrido_en?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      caballo: {
        Row: {
          actualizado_en: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_caballo"]
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          foto_url: string | null
          id: string
          instalacion_id: string | null
          nombre: string
          pelaje: string | null
          peso_kg: number | null
          propietario_id: string | null
          raza: string | null
          sexo: Database["public"]["Enums"]["sexo_caballo"] | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_caballo"]
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          foto_url?: string | null
          id?: string
          instalacion_id?: string | null
          nombre: string
          pelaje?: string | null
          peso_kg?: number | null
          propietario_id?: string | null
          raza?: string | null
          sexo?: Database["public"]["Enums"]["sexo_caballo"] | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_caballo"]
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          foto_url?: string | null
          id?: string
          instalacion_id?: string | null
          nombre?: string
          pelaje?: string | null
          peso_kg?: number | null
          propietario_id?: string | null
          raza?: string | null
          sexo?: Database["public"]["Enums"]["sexo_caballo"] | null
        }
        Relationships: [
          {
            foreignKeyName: "caballo_instalacion_id_fkey"
            columns: ["instalacion_id"]
            isOneToOne: false
            referencedRelation: "instalacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caballo_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      clase: {
        Row: {
          actualizado_en: string
          creado_en: string
          cupo: number | null
          duracion_min: number
          estado: Database["public"]["Enums"]["estado_clase"]
          id: string
          inicia_en: string
          instalacion_id: string
          instructor_id: string
          motivo_suspension: string | null
          nivel: Database["public"]["Enums"]["nivel_alumno"] | null
          servicio_id: string
          transcurre: unknown
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          cupo?: number | null
          duracion_min: number
          estado?: Database["public"]["Enums"]["estado_clase"]
          id?: string
          inicia_en: string
          instalacion_id: string
          instructor_id: string
          motivo_suspension?: string | null
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          servicio_id: string
          transcurre?: unknown
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          cupo?: number | null
          duracion_min?: number
          estado?: Database["public"]["Enums"]["estado_clase"]
          id?: string
          inicia_en?: string
          instalacion_id?: string
          instructor_id?: string
          motivo_suspension?: string | null
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          servicio_id?: string
          transcurre?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "clase_instalacion_id_fkey"
            columns: ["instalacion_id"]
            isOneToOne: false
            referencedRelation: "instalacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clase_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clase_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente: {
        Row: {
          activo: boolean
          actualizado_en: string
          canal_preferido: Database["public"]["Enums"]["canal_mensaje"]
          condicion_iva: Database["public"]["Enums"]["condicion_iva"] | null
          consentimiento_en: string | null
          consentimiento_medio: string | null
          consentimiento_revocado_en: string | null
          creado_en: string
          cuit: string | null
          dia_vencimiento: number | null
          id: string
          persona_id: string | null
          razon_social: string | null
          requiere_factura: boolean
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          canal_preferido?: Database["public"]["Enums"]["canal_mensaje"]
          condicion_iva?: Database["public"]["Enums"]["condicion_iva"] | null
          consentimiento_en?: string | null
          consentimiento_medio?: string | null
          consentimiento_revocado_en?: string | null
          creado_en?: string
          cuit?: string | null
          dia_vencimiento?: number | null
          id?: string
          persona_id?: string | null
          razon_social?: string | null
          requiere_factura?: boolean
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          canal_preferido?: Database["public"]["Enums"]["canal_mensaje"]
          condicion_iva?: Database["public"]["Enums"]["condicion_iva"] | null
          consentimiento_en?: string | null
          consentimiento_medio?: string | null
          consentimiento_revocado_en?: string | null
          creado_en?: string
          cuit?: string | null
          dia_vencimiento?: number | null
          id?: string
          persona_id?: string | null
          razon_social?: string | null
          requiere_factura?: boolean
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
        }
        Relationships: [
          {
            foreignKeyName: "cliente_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobante: {
        Row: {
          actualizado_en: string
          cae: string | null
          cae_vencimiento: string | null
          cliente_id: string
          comprobante_asociado_id: string | null
          creado_en: string
          emisor_condicion_iva: Database["public"]["Enums"]["condicion_iva_emisor"]
          emisor_cuit: string
          emisor_razon_social: string
          estado: Database["public"]["Enums"]["estado_comprobante"]
          estado_cuenta_id: string | null
          fecha_emision: string
          id: string
          iva: number
          neto: number
          numero: number
          pdf_url: string | null
          punto_venta_id: string
          receptor_condicion_iva: Database["public"]["Enums"]["condicion_iva"]
          rechazo_motivo: string | null
          tipo: Database["public"]["Enums"]["tipo_comprobante"]
          total: number
        }
        Insert: {
          actualizado_en?: string
          cae?: string | null
          cae_vencimiento?: string | null
          cliente_id: string
          comprobante_asociado_id?: string | null
          creado_en?: string
          emisor_condicion_iva: Database["public"]["Enums"]["condicion_iva_emisor"]
          emisor_cuit: string
          emisor_razon_social: string
          estado?: Database["public"]["Enums"]["estado_comprobante"]
          estado_cuenta_id?: string | null
          fecha_emision?: string
          id?: string
          iva?: number
          neto: number
          numero: number
          pdf_url?: string | null
          punto_venta_id: string
          receptor_condicion_iva: Database["public"]["Enums"]["condicion_iva"]
          rechazo_motivo?: string | null
          tipo: Database["public"]["Enums"]["tipo_comprobante"]
          total: number
        }
        Update: {
          actualizado_en?: string
          cae?: string | null
          cae_vencimiento?: string | null
          cliente_id?: string
          comprobante_asociado_id?: string | null
          creado_en?: string
          emisor_condicion_iva?: Database["public"]["Enums"]["condicion_iva_emisor"]
          emisor_cuit?: string
          emisor_razon_social?: string
          estado?: Database["public"]["Enums"]["estado_comprobante"]
          estado_cuenta_id?: string | null
          fecha_emision?: string
          id?: string
          iva?: number
          neto?: number
          numero?: number
          pdf_url?: string | null
          punto_venta_id?: string
          receptor_condicion_iva?: Database["public"]["Enums"]["condicion_iva"]
          rechazo_motivo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_comprobante"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprobante_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobante_comprobante_asociado_id_fkey"
            columns: ["comprobante_asociado_id"]
            isOneToOne: false
            referencedRelation: "comprobante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobante_estado_cuenta_id_fkey"
            columns: ["estado_cuenta_id"]
            isOneToOne: false
            referencedRelation: "estado_cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobante_punto_venta_id_fkey"
            columns: ["punto_venta_id"]
            isOneToOne: false
            referencedRelation: "punto_venta"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato: {
        Row: {
          actualizado_en: string
          alumno_id: string | null
          caballo_id: string | null
          cliente_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_contrato"]
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          importe_pactado: number | null
          servicio_id: string
        }
        Insert: {
          actualizado_en?: string
          alumno_id?: string | null
          caballo_id?: string | null
          cliente_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_contrato"]
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          importe_pactado?: number | null
          servicio_id: string
        }
        Update: {
          actualizado_en?: string
          alumno_id?: string | null
          caballo_id?: string | null
          cliente_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_contrato"]
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          importe_pactado?: number | null
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno_sin_datos_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_caballo_fk"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      cuenta_corriente: {
        Row: {
          actualizado_en: string
          cliente_id: string
          creado_en: string
          id: string
          saldo: number
          saldo_actualizado_en: string | null
        }
        Insert: {
          actualizado_en?: string
          cliente_id: string
          creado_en?: string
          id?: string
          saldo?: number
          saldo_actualizado_en?: string | null
        }
        Update: {
          actualizado_en?: string
          cliente_id?: string
          creado_en?: string
          id?: string
          saldo?: number
          saldo_actualizado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuenta_corriente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_orden_compra: {
        Row: {
          actualizado_en: string
          cantidad: number
          cantidad_recibida: number | null
          creado_en: string
          id: string
          insumo_id: string
          orden_compra_id: string
          precio_unitario: number
        }
        Insert: {
          actualizado_en?: string
          cantidad: number
          cantidad_recibida?: number | null
          creado_en?: string
          id?: string
          insumo_id: string
          orden_compra_id: string
          precio_unitario: number
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          cantidad_recibida?: number | null
          creado_en?: string
          id?: string
          insumo_id?: string
          orden_compra_id?: string
          precio_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_orden_compra_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_orden_compra_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "orden_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      estado_cuenta: {
        Row: {
          actualizado_en: string
          cliente_id: string
          creado_en: string
          emitido_en: string
          enviado_en: string | null
          estado_envio: Database["public"]["Enums"]["estado_envio"]
          id: string
          link_pago: string | null
          pdf_url: string | null
          periodo: string
          saldo_anterior: number
          total: number
        }
        Insert: {
          actualizado_en?: string
          cliente_id: string
          creado_en?: string
          emitido_en?: string
          enviado_en?: string | null
          estado_envio?: Database["public"]["Enums"]["estado_envio"]
          id?: string
          link_pago?: string | null
          pdf_url?: string | null
          periodo: string
          saldo_anterior?: number
          total: number
        }
        Update: {
          actualizado_en?: string
          cliente_id?: string
          creado_en?: string
          emitido_en?: string
          enviado_en?: string | null
          estado_envio?: Database["public"]["Enums"]["estado_envio"]
          id?: string
          link_pago?: string | null
          pdf_url?: string | null
          periodo?: string
          saldo_anterior?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "estado_cuenta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      evento: {
        Row: {
          actualizado_en: string
          cierra_inscripcion_en: string | null
          creado_en: string
          cupo: number | null
          estado: Database["public"]["Enums"]["estado_evento"]
          finaliza_en: string | null
          id: string
          inicia_en: string
          nombre: string
          servicio_id: string | null
          tipo: Database["public"]["Enums"]["tipo_evento"]
        }
        Insert: {
          actualizado_en?: string
          cierra_inscripcion_en?: string | null
          creado_en?: string
          cupo?: number | null
          estado?: Database["public"]["Enums"]["estado_evento"]
          finaliza_en?: string | null
          id?: string
          inicia_en: string
          nombre: string
          servicio_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_evento"]
        }
        Update: {
          actualizado_en?: string
          cierra_inscripcion_en?: string | null
          creado_en?: string
          cupo?: number | null
          estado?: Database["public"]["Enums"]["estado_evento"]
          finaliza_en?: string | null
          id?: string
          inicia_en?: string
          nombre?: string
          servicio_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento"]
        }
        Relationships: [
          {
            foreignKeyName: "evento_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_sanitario: {
        Row: {
          actualizado_en: string
          caballo_id: string
          costo: number | null
          creado_en: string
          dosis: string | null
          estado: Database["public"]["Enums"]["estado_evento_sanitario"]
          fecha: string
          id: string
          observaciones: string | null
          producto: string | null
          profesional: string | null
          proxima_fecha: string | null
          registro_cuidado_id: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_sanitario"]
        }
        Insert: {
          actualizado_en?: string
          caballo_id: string
          costo?: number | null
          creado_en?: string
          dosis?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_sanitario"]
          fecha: string
          id?: string
          observaciones?: string | null
          producto?: string | null
          profesional?: string | null
          proxima_fecha?: string | null
          registro_cuidado_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_evento_sanitario"]
        }
        Update: {
          actualizado_en?: string
          caballo_id?: string
          costo?: number | null
          creado_en?: string
          dosis?: string | null
          estado?: Database["public"]["Enums"]["estado_evento_sanitario"]
          fecha?: string
          id?: string
          observaciones?: string | null
          producto?: string | null
          profesional?: string | null
          proxima_fecha?: string | null
          registro_cuidado_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_evento_sanitario"]
        }
        Relationships: [
          {
            foreignKeyName: "evento_sanitario_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_sanitario_registro_cuidado_id_fkey"
            columns: ["registro_cuidado_id"]
            isOneToOne: false
            referencedRelation: "registro_cuidado"
            referencedColumns: ["id"]
          },
        ]
      }
      identidad_fiscal: {
        Row: {
          actualizado_en: string
          condicion_iva: Database["public"]["Enums"]["condicion_iva_emisor"]
          creado_en: string
          cuit: string
          domicilio_fiscal: string
          id: string
          ingresos_brutos: string | null
          inicio_actividades: string
          razon_social: string
          vigente_desde: string
        }
        Insert: {
          actualizado_en?: string
          condicion_iva: Database["public"]["Enums"]["condicion_iva_emisor"]
          creado_en?: string
          cuit: string
          domicilio_fiscal: string
          id?: string
          ingresos_brutos?: string | null
          inicio_actividades: string
          razon_social: string
          vigente_desde: string
        }
        Update: {
          actualizado_en?: string
          condicion_iva?: Database["public"]["Enums"]["condicion_iva_emisor"]
          creado_en?: string
          cuit?: string
          domicilio_fiscal?: string
          id?: string
          ingresos_brutos?: string | null
          inicio_actividades?: string
          razon_social?: string
          vigente_desde?: string
        }
        Relationships: []
      }
      inscripcion: {
        Row: {
          actualizado_en: string
          alumno_id: string
          caballo_id: string | null
          cancelado_en: string | null
          clase_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_inscripcion"]
          id: string
          inscripto_en: string
        }
        Insert: {
          actualizado_en?: string
          alumno_id: string
          caballo_id?: string | null
          cancelado_en?: string | null
          clase_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          id?: string
          inscripto_en?: string
        }
        Update: {
          actualizado_en?: string
          alumno_id?: string
          caballo_id?: string | null
          cancelado_en?: string | null
          clase_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          id?: string
          inscripto_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripcion_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno_sin_datos_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_clase_id_fkey"
            columns: ["clase_id"]
            isOneToOne: false
            referencedRelation: "clase"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripcion_evento: {
        Row: {
          actualizado_en: string
          alumno_id: string | null
          caballo_id: string | null
          cliente_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_inscripcion_evento"]
          evento_id: string
          id: string
        }
        Insert: {
          actualizado_en?: string
          alumno_id?: string | null
          caballo_id?: string | null
          cliente_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion_evento"]
          evento_id: string
          id?: string
        }
        Update: {
          actualizado_en?: string
          alumno_id?: string | null
          caballo_id?: string | null
          cliente_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion_evento"]
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripcion_evento_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_evento_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumno_sin_datos_medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_evento_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_evento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripcion_evento_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "evento"
            referencedColumns: ["id"]
          },
        ]
      }
      instalacion: {
        Row: {
          activo: boolean
          actualizado_en: string
          capacidad: number
          creado_en: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_instalacion"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          capacidad?: number
          creado_en?: string
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_instalacion"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          capacidad?: number
          creado_en?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_instalacion"]
        }
        Relationships: []
      }
      insumo: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: Database["public"]["Enums"]["categoria_insumo"]
          creado_en: string
          id: string
          nombre: string
          stock_actual: number
          stock_minimo: number
          unidad: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria: Database["public"]["Enums"]["categoria_insumo"]
          creado_en?: string
          id?: string
          nombre: string
          stock_actual?: number
          stock_minimo?: number
          unidad: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: Database["public"]["Enums"]["categoria_insumo"]
          creado_en?: string
          id?: string
          nombre?: string
          stock_actual?: number
          stock_minimo?: number
          unidad?: string
        }
        Relationships: []
      }
      mensaje: {
        Row: {
          actualizado_en: string
          canal: Database["public"]["Enums"]["canal_mensaje"]
          cliente_id: string
          creado_en: string
          destino: string
          enviado_en: string | null
          error: string | null
          estado: Database["public"]["Enums"]["estado_envio"]
          estado_cuenta_id: string | null
          id: string
          plantilla_id: string
        }
        Insert: {
          actualizado_en?: string
          canal: Database["public"]["Enums"]["canal_mensaje"]
          cliente_id: string
          creado_en?: string
          destino: string
          enviado_en?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_envio"]
          estado_cuenta_id?: string | null
          id?: string
          plantilla_id: string
        }
        Update: {
          actualizado_en?: string
          canal?: Database["public"]["Enums"]["canal_mensaje"]
          cliente_id?: string
          creado_en?: string
          destino?: string
          enviado_en?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_envio"]
          estado_cuenta_id?: string | null
          id?: string
          plantilla_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensaje_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensaje_estado_cuenta_id_fkey"
            columns: ["estado_cuenta_id"]
            isOneToOne: false
            referencedRelation: "estado_cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensaje_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantilla_mensaje"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_cuenta: {
        Row: {
          actualizado_en: string
          aplicado_por: string | null
          comprobante_id: string | null
          concepto: string
          contrato_id: string | null
          creado_en: string
          cuenta_corriente_id: string
          id: string
          importe: number
          mora_base: number | null
          mora_dias: number | null
          mora_tasa_aplicada: number | null
          pago_id: string | null
          periodo: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento_cuenta"]
          vence_en: string | null
        }
        Insert: {
          actualizado_en?: string
          aplicado_por?: string | null
          comprobante_id?: string | null
          concepto: string
          contrato_id?: string | null
          creado_en?: string
          cuenta_corriente_id: string
          id?: string
          importe: number
          mora_base?: number | null
          mora_dias?: number | null
          mora_tasa_aplicada?: number | null
          pago_id?: string | null
          periodo?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento_cuenta"]
          vence_en?: string | null
        }
        Update: {
          actualizado_en?: string
          aplicado_por?: string | null
          comprobante_id?: string | null
          concepto?: string
          contrato_id?: string | null
          creado_en?: string
          cuenta_corriente_id?: string
          id?: string
          importe?: number
          mora_base?: number | null
          mora_dias?: number | null
          mora_tasa_aplicada?: number | null
          pago_id?: string | null
          periodo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento_cuenta"]
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_cuenta_aplicado_por_fkey"
            columns: ["aplicado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "comprobante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_cuenta_corriente_id_fkey"
            columns: ["cuenta_corriente_id"]
            isOneToOne: false
            referencedRelation: "cuenta_corriente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pago"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_stock: {
        Row: {
          actualizado_en: string
          cantidad: number
          creado_en: string
          id: string
          insumo_id: string
          motivo: string | null
          ocurrido_en: string
          orden_compra_id: string | null
          registro_cuidado_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento_stock"]
        }
        Insert: {
          actualizado_en?: string
          cantidad: number
          creado_en?: string
          id?: string
          insumo_id: string
          motivo?: string | null
          ocurrido_en?: string
          orden_compra_id?: string | null
          registro_cuidado_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento_stock"]
        }
        Update: {
          actualizado_en?: string
          cantidad?: number
          creado_en?: string
          id?: string
          insumo_id?: string
          motivo?: string | null
          ocurrido_en?: string
          orden_compra_id?: string | null
          registro_cuidado_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento_stock"]
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_stock_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_stock_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "orden_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_stock_registro_cuidado_id_fkey"
            columns: ["registro_cuidado_id"]
            isOneToOne: false
            referencedRelation: "registro_cuidado"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_compra: {
        Row: {
          actualizado_en: string
          anio: number
          creado_en: string
          estado: Database["public"]["Enums"]["estado_orden_compra"]
          fecha_emision: string
          id: string
          numero: number
          proveedor_id: string
          total: number
        }
        Insert: {
          actualizado_en?: string
          anio?: number
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_orden_compra"]
          fecha_emision?: string
          id?: string
          numero?: number
          proveedor_id: string
          total?: number
        }
        Update: {
          actualizado_en?: string
          anio?: number
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_orden_compra"]
          fecha_emision?: string
          id?: string
          numero?: number
          proveedor_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orden_compra_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pago: {
        Row: {
          acreditado_en: string | null
          actualizado_en: string
          cliente_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_pago"]
          id: string
          importe: number
          medio: Database["public"]["Enums"]["medio_pago"]
          referencia_externa: string | null
        }
        Insert: {
          acreditado_en?: string | null
          actualizado_en?: string
          cliente_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          importe: number
          medio: Database["public"]["Enums"]["medio_pago"]
          referencia_externa?: string | null
        }
        Update: {
          acreditado_en?: string | null
          actualizado_en?: string
          cliente_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          id?: string
          importe?: number
          medio?: Database["public"]["Enums"]["medio_pago"]
          referencia_externa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pago_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      parametro: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          ayuda: string
          clave: string
          creado_en: string
          etiqueta: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_parametro"]
          valor: string | null
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          ayuda: string
          clave: string
          creado_en?: string
          etiqueta: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_parametro"]
          valor?: string | null
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          ayuda?: string
          clave?: string
          creado_en?: string
          etiqueta?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_parametro"]
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parametro_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      persona: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellido: string
          creado_en: string
          domicilio: string | null
          email: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          numero_documento: string
          telefono: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellido: string
          creado_en?: string
          domicilio?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          numero_documento: string
          telefono?: string | null
          tipo_documento: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string
          creado_en?: string
          domicilio?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          numero_documento?: string
          telefono?: string | null
          tipo_documento?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: []
      }
      plan_alimentario: {
        Row: {
          actualizado_en: string
          caballo_id: string
          cantidad_kg: number | null
          creado_en: string
          descripcion: string
          id: string
          insumo_id: string | null
          momento: Database["public"]["Enums"]["momento_alimentacion"]
          vigente_desde: string
        }
        Insert: {
          actualizado_en?: string
          caballo_id: string
          cantidad_kg?: number | null
          creado_en?: string
          descripcion: string
          id?: string
          insumo_id?: string | null
          momento: Database["public"]["Enums"]["momento_alimentacion"]
          vigente_desde: string
        }
        Update: {
          actualizado_en?: string
          caballo_id?: string
          cantidad_kg?: number | null
          creado_en?: string
          descripcion?: string
          id?: string
          insumo_id?: string | null
          momento?: Database["public"]["Enums"]["momento_alimentacion"]
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_alimentario_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_alimentario_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumo"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_mensaje: {
        Row: {
          activa: boolean
          actualizado_en: string
          asunto: string | null
          canal: Database["public"]["Enums"]["canal_mensaje"]
          categoria: Database["public"]["Enums"]["categoria_plantilla"] | null
          codigo: string
          creado_en: string
          cuerpo: string
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion"]
          firmante_origen: Database["public"]["Enums"]["origen_firmante"]
          id: string
          idioma: string | null
          motivo_rechazo: string | null
          nombre_meta: string | null
          revisada_en: string | null
        }
        Insert: {
          activa?: boolean
          actualizado_en?: string
          asunto?: string | null
          canal: Database["public"]["Enums"]["canal_mensaje"]
          categoria?: Database["public"]["Enums"]["categoria_plantilla"] | null
          codigo: string
          creado_en?: string
          cuerpo: string
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          firmante_origen?: Database["public"]["Enums"]["origen_firmante"]
          id?: string
          idioma?: string | null
          motivo_rechazo?: string | null
          nombre_meta?: string | null
          revisada_en?: string | null
        }
        Update: {
          activa?: boolean
          actualizado_en?: string
          asunto?: string | null
          canal?: Database["public"]["Enums"]["canal_mensaje"]
          categoria?: Database["public"]["Enums"]["categoria_plantilla"] | null
          codigo?: string
          creado_en?: string
          cuerpo?: string
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          firmante_origen?: Database["public"]["Enums"]["origen_firmante"]
          id?: string
          idioma?: string | null
          motivo_rechazo?: string | null
          nombre_meta?: string | null
          revisada_en?: string | null
        }
        Relationships: []
      }
      proveedor: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          cuit: string | null
          email: string | null
          id: string
          razon_social: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          cuit?: string | null
          email?: string | null
          id?: string
          razon_social: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          cuit?: string | null
          email?: string | null
          id?: string
          razon_social?: string
          telefono?: string | null
        }
        Relationships: []
      }
      punto_venta: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          descripcion: string
          id: string
          modo: Database["public"]["Enums"]["modo_punto_venta"]
          numero: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          descripcion: string
          id?: string
          modo: Database["public"]["Enums"]["modo_punto_venta"]
          numero: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          descripcion?: string
          id?: string
          modo?: Database["public"]["Enums"]["modo_punto_venta"]
          numero?: number
        }
        Relationships: []
      }
      registro_cuidado: {
        Row: {
          actualizado_en: string
          caballo_id: string | null
          creado_en: string
          id: string
          instalacion_id: string | null
          observaciones: string | null
          ocurrido_en: string
          registrado_en: string
          sincronizado_en: string | null
          tipo: Database["public"]["Enums"]["tipo_cuidado"]
          usuario_id: string
        }
        Insert: {
          actualizado_en?: string
          caballo_id?: string | null
          creado_en?: string
          id: string
          instalacion_id?: string | null
          observaciones?: string | null
          ocurrido_en: string
          registrado_en: string
          sincronizado_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_cuidado"]
          usuario_id: string
        }
        Update: {
          actualizado_en?: string
          caballo_id?: string | null
          creado_en?: string
          id?: string
          instalacion_id?: string | null
          observaciones?: string | null
          ocurrido_en?: string
          registrado_en?: string
          sincronizado_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cuidado"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registro_cuidado_caballo_id_fkey"
            columns: ["caballo_id"]
            isOneToOne: false
            referencedRelation: "caballo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_cuidado_instalacion_id_fkey"
            columns: ["instalacion_id"]
            isOneToOne: false
            referencedRelation: "instalacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_cuidado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio: {
        Row: {
          activo: boolean
          actualizado_en: string
          aplica_a: Database["public"]["Enums"]["aplica_servicio"]
          creado_en: string
          id: string
          modalidad: Database["public"]["Enums"]["modalidad_servicio"] | null
          nombre: string
          unidad: Database["public"]["Enums"]["unidad_servicio"]
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          aplica_a: Database["public"]["Enums"]["aplica_servicio"]
          creado_en?: string
          id?: string
          modalidad?: Database["public"]["Enums"]["modalidad_servicio"] | null
          nombre: string
          unidad: Database["public"]["Enums"]["unidad_servicio"]
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          aplica_a?: Database["public"]["Enums"]["aplica_servicio"]
          creado_en?: string
          id?: string
          modalidad?: Database["public"]["Enums"]["modalidad_servicio"] | null
          nombre?: string
          unidad?: Database["public"]["Enums"]["unidad_servicio"]
        }
        Relationships: []
      }
      tarifa: {
        Row: {
          actualizado_en: string
          creado_en: string
          id: string
          importe: number
          servicio_id: string
          vigente_desde: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          id?: string
          importe: number
          servicio_id: string
          vigente_desde: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          id?: string
          importe?: number
          servicio_id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          id: string
          persona_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          ultimo_acceso_en: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          id: string
          persona_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          ultimo_acceso_en?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          id?: string
          persona_id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          ultimo_acceso_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuario_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      alumno_sin_datos_medicos: {
        Row: {
          activo: boolean | null
          actualizado_en: string | null
          cliente_id: string | null
          consentimiento_tutor_en: string | null
          creado_en: string | null
          id: string | null
          nivel: Database["public"]["Enums"]["nivel_alumno"] | null
          persona_id: string | null
          responsable_id: string | null
        }
        Insert: {
          activo?: boolean | null
          actualizado_en?: string | null
          cliente_id?: string | null
          consentimiento_tutor_en?: string | null
          creado_en?: string | null
          id?: string | null
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          persona_id?: string | null
          responsable_id?: string | null
        }
        Update: {
          activo?: boolean | null
          actualizado_en?: string | null
          cliente_id?: string | null
          consentimiento_tutor_en?: string | null
          creado_en?: string | null
          id?: string | null
          nivel?: Database["public"]["Enums"]["nivel_alumno"] | null
          persona_id?: string | null
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumno_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumno_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: true
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumno_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "persona"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      alumnos_con_contrato_vigente: {
        Args: { p_al?: string; p_servicio: string }
        Returns: string[]
      }
      base_de_mora: {
        Args: { p_al: string; p_cuenta: string }
        Returns: number
      }
      clientes_del_usuario: { Args: never; Returns: string[] }
      es_admin: { Args: never; Returns: boolean }
      es_personal: { Args: never; Returns: boolean }
      instalar_auditoria: { Args: never; Returns: undefined }
      instalar_tocar_actualizado_en: { Args: never; Returns: undefined }
      ocupacion_evento: { Args: { p_evento: string }; Returns: number }
      persona_actual: { Args: never; Returns: string }
      rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      tiene_contrato_vigente: {
        Args: { p_al?: string; p_alumno: string; p_servicio: string }
        Returns: boolean
      }
      usuario_actual: { Args: never; Returns: string }
    }
    Enums: {
      accion_auditoria: "alta" | "modificacion" | "baja"
      aplica_servicio: "caballo" | "alumno"
      canal_mensaje: "whatsapp" | "email"
      categoria_insumo: "alimento" | "cama" | "sanidad" | "mantenimiento"
      categoria_plantilla: "utility" | "marketing"
      condicion_iva:
        | "responsable_inscripto"
        | "monotributo"
        | "consumidor_final"
        | "exento"
      condicion_iva_emisor: "monotributo" | "exento" | "responsable_inscripto"
      estado_aprobacion:
        | "borrador"
        | "en_revision"
        | "aprobada"
        | "rechazada"
        | "pausada"
      estado_caballo: "activo" | "en_tratamiento" | "retirado"
      estado_clase: "programada" | "dictada" | "cancelada"
      estado_comprobante: "pendiente" | "autorizado" | "rechazado"
      estado_contrato: "vigente" | "suspendido" | "finalizado"
      estado_envio: "pendiente" | "enviado" | "entregado" | "leido" | "fallido"
      estado_evento: "borrador" | "abierto" | "cerrado" | "realizado"
      estado_evento_sanitario: "previsto" | "aplicado" | "omitido"
      estado_inscripcion: "inscripto" | "cancelado"
      estado_inscripcion_evento: "inscripto" | "cancelado" | "participo"
      estado_orden_compra:
        | "borrador"
        | "enviada"
        | "parcialmente_recibida"
        | "recibida"
        | "anulada"
      estado_pago: "pendiente" | "acreditado" | "rechazado" | "devuelto"
      medio_pago: "mercadopago" | "transferencia" | "efectivo" | "cheque"
      modalidad_servicio: "individual" | "grupal"
      modo_punto_venta: "web_service" | "en_linea"
      momento_alimentacion: "manana" | "mediodia" | "tarde"
      nivel_alumno: "inicial" | "nivel_1" | "nivel_2" | "nivel_3"
      origen_firmante:
        | "responsable_cobranza"
        | "instructor_clase"
        | "quien_envia"
      rol_usuario: "administrador" | "instructor" | "peon" | "cliente"
      sexo_caballo: "macho" | "macho_castrado" | "hembra"
      tipo_cliente: "persona_fisica" | "persona_juridica"
      tipo_comprobante:
        | "factura_a"
        | "factura_b"
        | "factura_c"
        | "nota_credito"
        | "nota_debito"
      tipo_cuidado: "alimentacion" | "higiene" | "desparasitacion"
      tipo_documento: "dni" | "cuit" | "cuil" | "pasaporte"
      tipo_evento: "torneo" | "exposicion" | "colonia" | "otro"
      tipo_evento_sanitario:
        | "desparasitacion"
        | "vacunacion"
        | "herrador"
        | "veterinario"
        | "otro"
      tipo_instalacion: "box" | "piquete" | "pista" | "picadero"
      tipo_movimiento_cuenta: "cargo" | "pago" | "ajuste" | "interes_mora"
      tipo_movimiento_stock: "ingreso" | "egreso" | "ajuste"
      tipo_parametro: "entero" | "decimal" | "booleano" | "texto"
      unidad_servicio: "mensual" | "por_clase" | "por_evento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      accion_auditoria: ["alta", "modificacion", "baja"],
      aplica_servicio: ["caballo", "alumno"],
      canal_mensaje: ["whatsapp", "email"],
      categoria_insumo: ["alimento", "cama", "sanidad", "mantenimiento"],
      categoria_plantilla: ["utility", "marketing"],
      condicion_iva: [
        "responsable_inscripto",
        "monotributo",
        "consumidor_final",
        "exento",
      ],
      condicion_iva_emisor: ["monotributo", "exento", "responsable_inscripto"],
      estado_aprobacion: [
        "borrador",
        "en_revision",
        "aprobada",
        "rechazada",
        "pausada",
      ],
      estado_caballo: ["activo", "en_tratamiento", "retirado"],
      estado_clase: ["programada", "dictada", "cancelada"],
      estado_comprobante: ["pendiente", "autorizado", "rechazado"],
      estado_contrato: ["vigente", "suspendido", "finalizado"],
      estado_envio: ["pendiente", "enviado", "entregado", "leido", "fallido"],
      estado_evento: ["borrador", "abierto", "cerrado", "realizado"],
      estado_evento_sanitario: ["previsto", "aplicado", "omitido"],
      estado_inscripcion: ["inscripto", "cancelado"],
      estado_inscripcion_evento: ["inscripto", "cancelado", "participo"],
      estado_orden_compra: [
        "borrador",
        "enviada",
        "parcialmente_recibida",
        "recibida",
        "anulada",
      ],
      estado_pago: ["pendiente", "acreditado", "rechazado", "devuelto"],
      medio_pago: ["mercadopago", "transferencia", "efectivo", "cheque"],
      modalidad_servicio: ["individual", "grupal"],
      modo_punto_venta: ["web_service", "en_linea"],
      momento_alimentacion: ["manana", "mediodia", "tarde"],
      nivel_alumno: ["inicial", "nivel_1", "nivel_2", "nivel_3"],
      origen_firmante: [
        "responsable_cobranza",
        "instructor_clase",
        "quien_envia",
      ],
      rol_usuario: ["administrador", "instructor", "peon", "cliente"],
      sexo_caballo: ["macho", "macho_castrado", "hembra"],
      tipo_cliente: ["persona_fisica", "persona_juridica"],
      tipo_comprobante: [
        "factura_a",
        "factura_b",
        "factura_c",
        "nota_credito",
        "nota_debito",
      ],
      tipo_cuidado: ["alimentacion", "higiene", "desparasitacion"],
      tipo_documento: ["dni", "cuit", "cuil", "pasaporte"],
      tipo_evento: ["torneo", "exposicion", "colonia", "otro"],
      tipo_evento_sanitario: [
        "desparasitacion",
        "vacunacion",
        "herrador",
        "veterinario",
        "otro",
      ],
      tipo_instalacion: ["box", "piquete", "pista", "picadero"],
      tipo_movimiento_cuenta: ["cargo", "pago", "ajuste", "interes_mora"],
      tipo_movimiento_stock: ["ingreso", "egreso", "ajuste"],
      tipo_parametro: ["entero", "decimal", "booleano", "texto"],
      unidad_servicio: ["mensual", "por_clase", "por_evento"],
    },
  },
} as const
