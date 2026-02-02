
import React, { useState, useEffect } from 'react';
import { Mail, Shield, CheckCircle, Loader2, Save, ExternalLink, Play } from 'lucide-react';

export function EmailConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [config, setConfig] = useState({
        isActive: false,
        label: 'CSV-Imports',
        isConnected: false
    });
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [authStep, setAuthStep] = useState<'config' | 'code'>('config');

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        try {
            const response = await fetch('/api/settings/email/status');
            if (response.ok) {
                const status = await response.json();
                setConfig(status);
            }
        } catch (error) {
            console.error('Error loading email status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/settings/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: config.label, isActive: config.isActive })
            });
            if (response.ok) {
                await loadStatus();
                alert('Configuración guardada correctamente');
            } else {
                throw new Error('Error guardando');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error guardando configuración');
        } finally {
            setSaving(false);
        }
    };

    const startAuth = async () => {
        if (!clientId || !clientSecret) {
            alert('Por favor ingresa Client ID y Client Secret');
            return;
        }

        try {
            // Direct API call as workaround
            const response = await fetch('/api/settings/email/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientId: clientId.trim(),
                    clientSecret: clientSecret.trim()
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const { url } = data;

            // Redirect to Google OAuth (will come back to callback URL)
            window.location.href = url;
        } catch (error: any) {
            console.error(error);
            alert('Error generando URL: ' + (error.message || JSON.stringify(error) || 'Desconocido'));
        }
    };

    const submitCode = async () => {
        try {
            // Direct API call as workaround
            const response = await fetch('/api/settings/email/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: authCode })
            });

            if (!response.ok) {
                throw new Error('Error en autenticación');
            }

            alert('Conexión exitosa con Gmail');
            setAuthStep('config');
            setClientId('');
            setClientSecret('');
            setAuthCode('');
            loadStatus();
        } catch (error) {
            alert('Error autenticando con el código proporcionado');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando configuración...</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center">
                    <div className={`p-3 rounded-full mr-4 ${config.isConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Mail className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">Importación Automática desde Gmail</h3>
                        <p className="text-sm text-gray-500">
                            El sistema revisará tu correo cada 10-15 minutos buscando adjuntos CSV.
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {config.isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna 1: Configuración Básica */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Estado de la Automatización</label>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setConfig({ ...config, isActive: !config.isActive })}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${config.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config.isActive ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                            <span className="text-sm text-gray-600">
                                {config.isActive ? 'Activado' : 'Desactivado'}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Etiqueta de Gmail a monitorear</label>
                        <input
                            type="text"
                            value={config.label}
                            onChange={(e) => setConfig({ ...config, label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ej: CSV-Imports"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Crea esta etiqueta en tu Gmail y asignala a los correos que contengan los reportes CSV.
                        </p>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar Configuración
                        </button>

                        <button
                            onClick={async () => {
                                setRunning(true);
                                try {
                                    const response = await fetch('/api/settings/email/run', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' }
                                    });
                                    const res = await response.json();
                                    if (res.success) {
                                        alert(`Ejecución correcta. Procesados: ${res.processed || 0}`);
                                        // Trigger logs reload (using window refresh for simplicity or refactor context)
                                        window.location.reload();
                                    } else {
                                        alert(`Resultado: ${res.message || 'Sin cambios'}`);
                                    }
                                } catch (e: any) {
                                    alert('Error al ejecutar: ' + e.message);
                                } finally {
                                    setRunning(false);
                                }
                            }}
                            disabled={!config.isConnected || !config.isActive || running}
                            className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Ejecutar búsqueda ahora"
                        >
                            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                            Ejecutar Ahora
                        </button>
                    </div>
                </div>

                {/* Columna 2: Conexión OAuth */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-gray-500" />
                        Credenciales de Google Cloud
                    </h4>

                    {!config.isConnected ? (
                        <div className="space-y-4">
                            {authStep === 'config' ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase">Client ID</label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            placeholder="...apps.googleusercontent.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase">Client Secret</label>
                                        <input
                                            type="password"
                                            value={clientSecret}
                                            onChange={(e) => setClientSecret(e.target.value)}
                                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={startAuth}
                                        className="w-full flex justify-center items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Conectar con Gmail
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-600">
                                        Se ha abierto una ventana para autorizar. Copia el código que te dio Google y pégalo aquí:
                                    </p>
                                    <input
                                        type="text"
                                        value={authCode}
                                        onChange={(e) => setAuthCode(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        placeholder="Pegar código aquí"
                                    />
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={submitCode}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                        >
                                            Verificar Código
                                        </button>
                                        <button
                                            onClick={() => setAuthStep('config')}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-900"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                            <p className="text-green-700 font-medium">Cuenta Vinculada</p>
                            <p className="text-sm text-gray-500 mt-1">
                                El sistema tiene permiso para leer correos y descargar adjuntos.
                            </p>
                            <button
                                onClick={() => {
                                    if (confirm('¿Desconectar cuenta? Dejará de funcionar la importación automática.')) {
                                        setAuthStep('config');
                                        setConfig({ ...config, isConnected: false });
                                    }
                                }}
                                className="mt-4 text-xs text-red-600 hover:text-red-800 underline"
                            >
                                Desvincular cuenta
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Logs Section */}
            <div className="mt-8 border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Historial de Importaciones</h4>
                <LogsTable />
            </div>
        </div>
    );
}

function LogsTable() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const response = await fetch('/api/settings/email/logs');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    setLogs(data);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-sm text-gray-500">Cargando historial...</div>;
    if (logs.length === 0) return <div className="text-sm text-gray-500 italic">No hay registros de importación aún.</div>;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filas</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                        <tr key={log.id || log.batch_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {log.file_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    log.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {log.status === 'completed' ? 'Completado' : log.status === 'failed' ? 'Fallido' : log.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex flex-col">
                                    <span className="text-green-600">✅ {log.rows_success}</span>
                                    <span className="text-red-600">❌ {log.rows_failed}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
