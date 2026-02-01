# Nueva Funcionalidad: Pagar Pedido Específico

## 📋 Resumen
Se ha implementado una nueva funcionalidad en la página de Receivables que permite seleccionar un pedido específico de un cliente y pagarlo completamente.

## ✨ Características Implementadas

### 1. **Nuevo Botón "Pagar Pedido"**
- Ubicación: Sección "Cartera / Cuentas por Cobrar"
- Aparece junto al botón "Abono" existente
- Color verde para diferenciarlo del botón de abono
- Icono: CheckCircle

### 2. **Modal de Selección de Pedidos**
El modal muestra:
- **Información del Cliente**: Nombre y deuda total
- **Lista de Pedidos Pendientes**: Solo muestra pedidos con deuda > 0
- **Detalles de cada Pedido**:
  - Número de pedido
  - Fecha
  - Total
  - Monto pagado
  - Deuda pendiente

### 3. **Selección Interactiva**
- Los pedidos son clickeables
- El pedido seleccionado se resalta en verde
- Muestra un indicador visual "✓ Seleccionado"

### 4. **Formulario de Pago**
Una vez seleccionado un pedido, se muestra:
- **Medio de Pago** (requerido): Dropdown con métodos activos
- **Fecha de Pago**: Campo de fecha (por defecto: hoy)
- **Descripción**: Campo opcional (auto-completa con "Pago completo pedido #X")
- **Monto a Pagar**: Se muestra en grande y en verde (calculado automáticamente)

### 5. **Procesamiento del Pago**
Al confirmar:
1. Valida que se haya seleccionado un pedido y medio de pago
2. Calcula el monto exacto de la deuda del pedido
3. Muestra confirmación con el monto
4. Registra el pago usando el endpoint existente `/receivables/payments`
5. El backend aplica el pago siguiendo la lógica FIFO
6. Actualiza el estado del pedido a "pagado"
7. Recarga los datos automáticamente

## 🔧 Cambios Técnicos

### Frontend (`Receivables.jsx`)
1. **Imports agregados**:
   - `ordersService` de `../services/api`
   - `CheckCircle` de `lucide-react`

2. **Estados nuevos**:
   ```javascript
   const [showOrderModal, setShowOrderModal] = useState(false);
   const [clientOrders, setClientOrders] = useState([]);
   const [selectedOrder, setSelectedOrder] = useState(null);
   const [loadingOrders, setLoadingOrders] = useState(false);
   ```

3. **Funciones nuevas**:
   - `handleOpenOrderSelection(account)`: Abre el modal y carga pedidos del cliente
   - `handlePaySpecificOrder()`: Procesa el pago del pedido seleccionado

4. **Componentes UI**:
   - Botón "Pagar Pedido" en la tabla de cuentas
   - Modal completo de selección y pago de pedidos

### Backend
No se requirieron cambios en el backend. La funcionalidad utiliza los endpoints existentes:
- `GET /api/orders/?cliente_id={id}` - Para obtener pedidos del cliente
- `POST /api/receivables/payments` - Para registrar el pago

## 📖 Cómo Usar

1. **Ir a Receivables**: Navegar a `http://localhost:5173/receivables`
2. **Seleccionar Cliente**: En la tabla "Cartera / Cuentas por Cobrar"
3. **Hacer clic en "Pagar Pedido"**: Botón verde con icono de check
4. **Seleccionar Pedido**: Click en el pedido que desea pagar
5. **Completar Formulario**:
   - Seleccionar medio de pago
   - Ajustar fecha si es necesario
   - Agregar descripción (opcional)
6. **Confirmar Pago**: Click en "Confirmar Pago"
7. **Verificar**: El pedido desaparece de la lista de pendientes

## ✅ Validaciones Implementadas

- ✓ Solo muestra pedidos con deuda > 0.01
- ✓ Requiere selección de pedido y medio de pago
- ✓ Calcula automáticamente el monto exacto de la deuda
- ✓ Muestra confirmación antes de procesar
- ✓ Maneja errores con mensajes claros
- ✓ Recarga datos después del pago exitoso

## 🎨 Diseño

- **Modal responsivo**: Máximo 600px de ancho, 90vh de alto
- **Lista scrolleable**: Máximo 300px de altura para la lista de pedidos
- **Colores consistentes**:
  - Verde para acciones de pago completo
  - Rojo para deudas
  - Azul para abonos parciales
- **Feedback visual**: Hover effects y estados seleccionados

## 🔄 Flujo de Datos

```
Usuario → Click "Pagar Pedido" 
       → GET /api/orders/?cliente_id={id}
       → Muestra pedidos con deuda
       → Usuario selecciona pedido
       → Usuario completa formulario
       → POST /api/receivables/payments
       → Backend aplica pago (FIFO)
       → Pedido marcado como "pagado"
       → UI actualizada
```

## 📝 Notas Importantes

1. **FIFO se mantiene**: Aunque se seleccione un pedido específico, el backend sigue aplicando los pagos en orden FIFO (del más antiguo al más nuevo)
2. **Pago completo**: Esta funcionalidad está diseñada para pagar el pedido COMPLETO, no abonos parciales
3. **Trazabilidad**: El pago se registra en `pagos_pedidos` para mantener el historial exacto
4. **Compatible con abonos**: Esta funcionalidad coexiste con el sistema de abonos existente

## 🐛 Testing

Para probar la funcionalidad:
1. Asegurarse de que hay clientes con pedidos pendientes
2. Verificar que los pedidos tienen deuda > 0
3. Probar el pago completo de un pedido
4. Verificar que el pedido cambia a estado "pagado"
5. Verificar que el historial de abonos muestra el nuevo pago
