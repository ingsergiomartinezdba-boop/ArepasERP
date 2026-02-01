# Componente CloseButton - Estándar de Botones de Cerrar

## 📋 Descripción

`CloseButton` es el componente estándar para todos los botones de cerrar en modales, diálogos y ventanas emergentes de la aplicación.

## 🎨 Diseño

- **Fondo**: Naranja (`#ff9800`)
- **Símbolo**: X negra (`#000`)
- **Tamaño**: 32x32 píxeles
- **Bordes**: Redondeados (4px)
- **Hover**: Opacidad reducida (0.8)

## 📍 Ubicación

```
frontend/src/components/CloseButton.jsx
```

## 🔧 Uso

### Importación

```javascript
import CloseButton from '../components/CloseButton';
```

### Uso Básico

```jsx
<CloseButton onClick={() => setShowModal(false)} />
```

### Con Clases Adicionales

```jsx
<CloseButton 
    onClick={() => setShowModal(false)} 
    className="my-custom-class"
/>
```

### Con Estilos Adicionales

```jsx
<CloseButton 
    onClick={() => setShowModal(false)} 
    style={{ marginLeft: '10px' }}
/>
```

## 📝 Props

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `onClick` | Function | ✅ Sí | - | Función a ejecutar al hacer click |
| `className` | String | ❌ No | `''` | Clases CSS adicionales |
| `style` | Object | ❌ No | `{}` | Estilos inline adicionales |

## 💡 Ejemplo Completo en un Modal

```jsx
import CloseButton from '../components/CloseButton';

function MyModal({ show, onClose }) {
    if (!show) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                <div className="flex justify-between items-center mb-4">
                    <h3>Título del Modal</h3>
                    <CloseButton onClick={onClose} />
                </div>
                
                <div>
                    {/* Contenido del modal */}
                </div>
            </div>
        </div>
    );
}
```

## ✅ Ventajas

1. **Consistencia**: Todos los botones de cerrar tienen el mismo aspecto
2. **Mantenibilidad**: Un solo lugar para actualizar el estilo
3. **Accesibilidad**: Incluye `aria-label` automáticamente
4. **Interactividad**: Efecto hover incluido
5. **Flexibilidad**: Permite personalización cuando sea necesario

## 🔄 Migración de Código Existente

### Antes (código antiguo)

```jsx
<button onClick={() => setShowModal(false)} className="text-muted text-xl">
    &times;
</button>
```

### Después (usando CloseButton)

```jsx
<CloseButton onClick={() => setShowModal(false)} />
```

## 📦 Archivos Actualizados

Los siguientes archivos ya usan el componente `CloseButton`:

- ✅ `frontend/src/pages/Receivables.jsx` (2 modales)
  - Modal de Registrar/Modificar Abono
  - Modal de Pagar Pedido Específico

## 🚀 Para Nuevos Desarrollos

**IMPORTANTE**: Todos los nuevos modales, diálogos o ventanas emergentes DEBEN usar el componente `CloseButton` para mantener la consistencia visual de la aplicación.

### Checklist para Nuevos Modales

- [ ] Importar `CloseButton` desde `../components/CloseButton`
- [ ] Usar `<CloseButton onClick={...} />` en lugar de botones personalizados
- [ ] Verificar que el botón esté alineado a la derecha en el header
- [ ] Probar el efecto hover

## 🎯 Estilo Visual

```
┌─────────────────────────────────────┐
│ Título del Modal            [×]    │  ← Botón naranja con X negra
├─────────────────────────────────────┤
│                                     │
│  Contenido del modal                │
│                                     │
└─────────────────────────────────────┘
```

## 🔍 Código del Componente

El componente está en `frontend/src/components/CloseButton.jsx` y contiene:

- Estilos predeterminados (naranja con X negra)
- Efecto hover (opacidad)
- Accesibilidad (aria-label)
- Flexibilidad para personalización

## 📞 Soporte

Si necesitas modificar el estilo global de todos los botones de cerrar, edita el archivo:
```
frontend/src/components/CloseButton.jsx
```

Todos los botones se actualizarán automáticamente.
