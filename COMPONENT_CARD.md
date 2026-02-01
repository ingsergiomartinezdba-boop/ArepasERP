# Componente Card

El componente `Card` estandariza el diseño de los contenedores de información, proporcionando bordes, sombras y espaciado consistentes.

## Props

| Prop | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `title` | `string` | - | Título opcional en la cabecera de la tarjeta. |
| `footer` | `node` | - | Contenido opcional para el pie de la tarjeta. |
| `noPadding` | `boolean` | `false` | Si es true, elimina el padding interno del cuerpo. |
| `interactive` | `boolean` | `false` | Si es true, añade efectos visuales de hover y escala al hacer click. |
| `variant` | `string` | `'default'` | `'default'`, `'glass'`, `'outline'`. |
| `className` | `string` | `''` | Clases adicionales para el contenedor principal. |
| `bodyClassName` | `string` | `''` | Clases adicionales para el contenedor del cuerpo (donde está el padding). |
| `children` | `node` | - | Contenido principal de la tarjeta. |

## Uso Básico

```jsx
import { Card } from '../components';

<Card title="Resumen de Ventas" interactive>
    <p>Contenido principal aquí...</p>
</Card>
```

## Con Footer y Sin Padding

```jsx
<Card 
    title="Lista de Pedidos" 
    noPadding 
    footer={<Button fluid>Cargar Más</Button>}
>
    <table className="w-full">
        {/* Contenido sin padding lateral */}
    </table>
</Card>
```

## Archivos Migrados (Planificado)
- `Dashboard.jsx` (Widgets de estadísticas y flujo de caja)
- `Transfers.jsx` (Balances y formulario)
- `OrdersReport.jsx` (Resultados del reporte)
- `Products.jsx` / `Clients.jsx` (Ítems de las listas)
