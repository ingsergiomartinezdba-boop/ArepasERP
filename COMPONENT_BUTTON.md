# Componente Button - Documentación

## 📋 Descripción

`Button` es el componente estándar para botones en la aplicación ArepasERP. Estandariza el estilo, los tamaños y el manejo de iconos, eliminando la necesidad de aplicar clases manuales (`btn btn-primary`, etc.) y estilos inline en cada página.

## 🎨 Características

### Funcionalidades Incluidas
- ✅ **Variantes**: Soporta `primary`, `secondary`, `success` y `danger`.
- ✅ **Tamaños**: Soporta `sm`, `md` y `lg`.
- ✅ **Iconos**: Soporta un slot para iconos de Lucide con espaciado automático.
- ✅ **Fluid**: Opción `fluid` para ocupar el 100% del ancho del contenedor.
- ✅ **Accesibilidad**: Mantiene el comportamiento nativo de `<button>`.

## 📍 Ubicación

```
frontend/src/components/Button.jsx
```

## 🔧 Uso

### Importación

```javascript
import { Button } from '../components';
```

### Ejemplo Básico

```jsx
<Button onClick={handleClick}>
    Guardar
</Button>
```

### Ejemplo con Variante y Tamaño

```jsx
<Button variant="danger" size="sm" onClick={handleDelete}>
    Eliminar
</Button>
```

### Ejemplo con Icono

```jsx
import { Plus } from 'lucide-react';

<Button icon={<Plus size={18} />} onClick={handleNew}>
    Nuevo Registro
</Button>
```

### Ejemplo Solo Icono

```jsx
<Button icon={<Edit size={18} />} onClick={handleEdit} />
```

### Ejemplo Botón de Bloque (Fluid)

```jsx
<Button type="submit" fluid>
    Iniciar Sesión
</Button>
```

## 📝 Props

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `children` | ReactNode | ❌ No | - | Texto o elementos dentro del botón |
| `variant` | String | ❌ No | `'primary'` | Variante: `primary`, `secondary`, `success`, `danger` |
| `size` | String | ❌ No | `'md'` | Tamaño: `sm`, `md`, `lg` |
| `fluid` | Boolean | ❌ No | `false` | Si es `true`, aplica `width: 100%` |
| `icon` | ReactNode | ❌ No | - | Elemento de icono (ej: `<Plus />`) |
| `type` | String | ❌ No | `'button'` | Tipo nativo: `button`, `submit`, `reset` |
| `disabled` | Boolean | ❌ No | `false` | Estado deshabilitado |
| `onClick` | Function | ❌ No | - | Manejador de evento click |
| `className` | String | ❌ No | `''` | Clases CSS adicionales |
| `style` | Object | ❌ No | `{}` | Estilos inline adicionales |

## ✅ Archivos Migrados

El componente `Button` ya se utiliza en:

- 👥 `Clients.jsx`
- 📦 `Products.jsx`
- 🏢 `Suppliers.jsx`

**Siguiente paso**: Continuar con `Expenses.jsx` y `Receivables.jsx`.

---

**Creado**: 2026-01-31  
**Versión**: 1.0.0
