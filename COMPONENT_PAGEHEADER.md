# Componente PageHeader - Documentación

## 📋 Descripción

`PageHeader` es el componente estándar para los encabezados de página en la aplicación ArepasERP. Estandariza la disposición del título, botones de acción y elementos adicionales (filtros, buscadores, etc.).

## 🎨 Características

### Funcionalidades Incluidas
- ✅ **Título H1** integrado.
- ✅ **Slot para Acciones**: Área a la derecha para botones principales.
- ✅ **Slot para Children**: Área entre el título y las acciones para filtros o controles secundarios.
- ✅ **Responsive**: Adaptado para móviles y tablets.
- ✅ **Consistencia**: Margen inferior y espaciado predefinido.

## 📍 Ubicación

```
frontend/src/components/PageHeader.jsx
```

## 🔧 Uso

### Importación

```javascript
import { PageHeader } from '../components';
```

### Ejemplo Básico

```jsx
<PageHeader title="Proveedores" />
```

### Ejemplo con Botón de Acción

```jsx
<PageHeader 
    title="Clientes"
    action={
        <button onClick={startNew} className="btn btn-primary">
            <Plus size={20} />
        </button>
    }
/>
```

### Ejemplo con Filtros (Children)

```jsx
<PageHeader 
    title="Gastos"
    action={<TotalSummary total={total} />}
>
    <button onClick={handleNew} className="btn btn-primary">
        <Plus size={20} />
    </button>
    <DateFilter value={month} onChange={setMonth} />
</PageHeader>
```

### Ejemplo con Botón de Regresar

```jsx
<PageHeader title="Nuevo Gasto">
    <button onClick={() => navigate(-1)} className="btn btn-secondary">
        <ArrowLeft size={20} />
    </button>
</PageHeader>
```

## 📝 Props

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `title` | String | ✅ Sí | - | Texto principal del encabezado |
| `action` | ReactNode | ❌ No | - | Elemento(s) alineado(s) a la derecha |
| `children` | ReactNode | ❌ No | - | Elementos entre el título y la acción |
| `className` | String | ❌ No | `''` | Clases CSS adicionales |
| `style` | Object | ❌ No | `{}` | Estilos inline adicionales |

## ✅ Archivos Migrados

El componente `PageHeader` ya se utiliza en:

- 🏠 `Dashboard.jsx`
- 👥 `Clients.jsx` (Lista y Edición)
- 📦 `Products.jsx` (Lista y Edición)
- 💰 `Receivables.jsx`
- 📋 `OrdersList.jsx`
- 📊 `OrdersReport.jsx`
- 💸 `Expenses.jsx`
- ➕ `ExpenseForm.jsx`
- 🏢 `Suppliers.jsx`
- 💳 `PaymentMethods.jsx`
- 🔄 `Transfers.jsx`
- 📱 `WhatsappSummary.jsx`

**Total**: 12 archivos migrados, ~15 encabezados estandarizados.

## 📊 Impacto

### Código Eliminado
- **~25 líneas** de código repetitivo eliminadas.
- **12 archivos** simplificados.
- **100%** de consistencia en el diseño de encabezados.

## 🎯 Beneficios

1. **Estandarización**: Todos los títulos de página tienen el mismo tamaño y espaciado.
2. **Mantenibilidad**: Si se decide cambiar el margen inferior global, se hace en un solo lugar.
3. **Productividad**: Menos etiquetas `div` y clases `flex` manuales.

---

**Creado**: 2026-01-31  
**Versión**: 1.0.0
