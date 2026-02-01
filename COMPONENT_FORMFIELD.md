# Componente FormField

El componente `FormField` estandariza el diseño de los campos de formulario, manejando automáticamente etiquetas (labels), iconos, estados requeridos, mensajes de ayuda y mensajes de error.

## Props

| Prop | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `label` | `string` | - | Texto de la etiqueta sobre el campo. |
| `error` | `string` | - | Mensaje de error para mostrar debajo del campo. Si existe, reemplaza al `helpText`. |
| `required` | `boolean` | `false` | Si es true, añade un asterisco rojo (`*`) a la etiqueta. |
| `icon` | `element` | - | Icono de Lucide para mostrar junto a la etiqueta. |
| `helpText` | `string` | - | Texto informativo pequeño debajo del campo. |
| `className` | `string` | `''` | Clases de CSS adicionales para el contenedor. |
| `children` | `node` | - | El elemento de entrada (`input`, `select`, `textarea`). |

## Uso Básico

```jsx
import { FormField } from '../components';
import { User } from 'lucide-react';

<FormField 
    label="Nombre Completo" 
    icon={<User size={16} />} 
    required
    error={errors.nombre}
>
    <input 
        type="text" 
        value={formData.nombre} 
        onChange={e => setFormData({...formData, nombre: e.target.value})}
        className="form-control"
    />
</FormField>
```

## Ventajas
- **Consistencia**: Todos los campos tienen el mismo espaciado y estilo de etiqueta.
- **Accesibilidad**: Facilita la asociación visual de etiquetas y errores.
- **Limpieza de Código**: Elimina la repetición manual de divs `form-group`, labels y condicionales para errores.

## Archivos Migrados
- `Suppliers.jsx` (Modal de creación/edición)
- `Receivables.jsx` (Modal de abono)
- `ExpenseForm.jsx` (Formulario principal)
