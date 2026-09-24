# Trading agrícola — funcionalidad en pausa

Estado: archivada y fuera de la interfaz pública el 6 de septiembre de 2026.

La página actual queda enfocada exclusivamente en análisis de precios ODEPA. Este módulo se conserva como especificación para una futura etapa de mercado entre compradores y productores.

## Alcance que quedó diseñado

- Formulario para preparar una oferta de venta desde los filtros analíticos: región, producto, variedad, calidad y unidad de comercialización.
- Referencia de precio basada en el último día comparable. Si la serie no tiene reportes recientes (más de 10 días), propone una referencia estacional del mismo mes histórico, sin arrastrar un precio antiguo como si fuera actual.
- Rango mínimo–máximo y número de mercados comparados.
- Libro de órdenes para publicar intenciones de compra o venta con precio y cantidad por la unidad seleccionada.

## Estado técnico al reactivarlo

La primera versión guardaba las órdenes sólo en `localStorage` del navegador. No era un mercado compartido ni transaccional. Para reactivarla correctamente se requiere:

1. Un servicio autenticado para órdenes compartidas.
2. Identidad y datos de contacto verificados para comprador y vendedor.
3. Estados de orden (abierta, parcial, cerrada, cancelada) y trazabilidad.
4. Reglas de matching, notificaciones y validación comercial antes de exponer operaciones a terceros.

La lógica retirada vivía en `app/page.tsx`: cálculo de referencia de publicación, formulario de oferta y libro de órdenes. El historial de Git conserva la implementación visual anterior; este documento conserva el alcance y las condiciones para reintroducirla sin mezclarla con la vista analítica actual.
