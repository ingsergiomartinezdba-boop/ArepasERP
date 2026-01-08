import { useState, useEffect } from 'react';
import { reportsService } from '../services/api';
import { Copy } from 'lucide-react';

export default function WhatsappSummary() {
    const [summary, setSummary] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        reportsService.getWhatsappSummary()
            .then(res => setSummary(res.data.text))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(summary);
        alert("Copiado al portapapeles");
    };

    return (
        <div>
            <h1>Resumen WhatsApp</h1>
            <p className="text-muted mb-4">Lista de pedidos pendientes para envío.</p>

            {loading ? (
                <p>Generando...</p>
            ) : (
                <>
                    <div className="card">
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                            {summary || "No hay pedidos pendientes."}
                        </pre>
                    </div>

                    {summary && (
                        <button onClick={copyToClipboard} className="btn btn-primary">
                            <Copy size={20} style={{ marginRight: '8px' }} />
                            Copiar Texto
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
