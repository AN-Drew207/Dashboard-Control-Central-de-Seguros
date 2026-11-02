# InsureFlow · Control Central de Seguros

Demo de un sistema de gestión de cartera para corredores de seguros en Venezuela: cobranza, clientes, pólizas, renovaciones, reportes y un asistente de cartera.

Todo corre en el navegador. No hay backend: una API simulada guarda los datos en `localStorage`.

## Cuentas demo

| Rol | Correo | Contraseña | Acceso |
| --- | --- | --- | --- |
| Super Admin | admin@insureflow.demo | demo123 | Todo |
| Corredor | corredor@insureflow.demo | demo123 | Finanzas, comisiones, reportes, asistente |
| Asistente | asistente@insureflow.demo | demo123 | Pólizas, cobranza y verificación de pagos |

Los datos de ejemplo se generan con fechas relativas al día de hoy. Se pueden restablecer en **Configuración → Restablecer datos demo**.

## Funcionalidades

- **Dashboard**: primas de cartera, comisiones por cobrar, primas cobradas del mes, clientes en mora, emisiones contra la meta mensual, renovaciones a 30 días y cumpleaños de la semana.
- **Cobranza**: cuotas mensuales, trimestrales, semestrales y anuales con fechas exactas. Protocolo de cobro en 5 pasos (recordatorio previo → escalamiento). Flujo de pago: pendiente → reportado → verificado.
- **Recordatorios**: mensajes prellenados por WhatsApp (`wa.me`) o correo (`mailto:`), con registro de cada contacto.
- **Clientes**: cartera segmentada (VIP, mora, tipo de póliza), ficha con asegurados, histórico de contratos y notas.
- **Pólizas**: varias compañías en un solo lugar, cronograma de cobro generado al emitir, documentos (póliza/condicionado) y anulación con motivo.
- **Renovaciones**: a 30, 60 y 90 días, con ajuste de prima y frecuencia.
- **Reportes**: series de 12 meses, composición de la cartera, comisiones por compañía, oportunidades de venta cruzada y conclusiones automáticas.
- **Asistente IA**: responde preguntas sobre la cartera con reglas sobre los datos locales (aquí iría el LLM en producción).
- **Notificaciones**: mora, mora de más de 14 días, cumpleaños (hoy y en la semana), meta de emisiones superada y pagos por verificar.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · lucide-react.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de producción
```

## Estructura

```
src/
  app/                 Rutas (login y área (app) protegida)
  components/          Shell, UI base, gráficos, modales de cobranza y pólizas
  context/             AuthContext, DataContext, ToastContext
  lib/domain/          Reglas de negocio puras: fechas, dinero, pólizas, métricas, insights
  lib/mock-api/        API simulada (localStorage) y datos semilla
```

La lógica de negocio (`lib/domain`) no depende de React. Para conectar un backend real, se reemplaza `lib/mock-api/api.ts` por llamadas HTTP con las mismas firmas, sin tocar las pantallas.

### Exactitud

- Las fechas se manejan como `YYYY-MM-DD` y la aritmética va en UTC, sin desfase por zona horaria.
- Cada cuota se calcula desde la fecha de inicio (31 ene → 28/29 feb → 31 mar).
- Los montos se dividen en centavos enteros; la diferencia por redondeo va a la última cuota.

## Despliegue en Vercel

Importa el repositorio en Vercel. No hace falta configurar nada: framework Next.js y sin variables de entorno.
