import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Database,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Shield,
  Info,
  Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ExportOptions {
  includeSchema: boolean;
  includeData: boolean;
  includeFunctions: boolean;
  includeIndexes: boolean;
  compressOutput: boolean;
  tableSelection: 'all' | 'custom';
  selectedTables: string[];
}

interface ExportResult {
  success: boolean;
  message: string;
  downloadUrl?: string;
  fileSize?: number;
  recordCount?: number;
}

const AVAILABLE_TABLES = [
  { name: 'users', description: 'Usuarios del sistema de impresiones' },
  { name: 'prints_raw', description: 'Datos brutos de importación CSV' },
  { name: 'prints_monthly', description: 'Agregados mensuales optimizados' },
  { name: 'printers', description: 'Inventario de impresoras' },
  { name: 'user_printer_assignments', description: 'Asignaciones usuario-impresora' },
  { name: 'import_log', description: 'Historial de importaciones' }
];

export function DatabaseExport() {
  const { isSuperAdmin } = useAuth();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeSchema: true,
    includeData: true,
    includeFunctions: false,
    includeIndexes: true,
    compressOutput: false,
    tableSelection: 'all',
    selectedTables: []
  });
  const [result, setResult] = useState<ExportResult | null>(null);

  const exportMutation = useMutation({
    mutationFn: async (_options: ExportOptions): Promise<ExportResult> => {
      try {
        console.log('🚀 Iniciando exportación de base de datos via backend...');

        // Llamada directa usando fetch para evitar problemas de caché con apiClient
        const token = localStorage.getItem('impresiones_app_auth');
        const headers: HeadersInit = {};

        if (token) {
          try {
            const session = JSON.parse(token);
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          } catch (e) { console.error('Error parsing token', e); }
        }

        // Relative path uses Vite proxy
        const response = await fetch('/api/admin/export-sql', { headers });

        if (!response.ok) {
          throw new Error(`Error en la petición: ${response.statusText}`);
        }

        const blob = await response.blob();
        const totalRecords = response.headers.get('X-Total-Records');

        // Crear URL para descarga
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `sedcauca_database_export_${timestamp}.sql`;
        link.setAttribute('download', filename);

        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);

        return {
          success: true,
          message: `✅ Base de datos exportada exitosamente como ${filename}`,
          fileSize: blob.size,
          recordCount: totalRecords ? parseInt(totalRecords) : undefined
        };

      } catch (error) {
        console.error('💥 Error en exportación:', error);
        return {
          success: false,
          message: `❌ Error exportando base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result) => {
      setResult(result);
    }
  });

  const handleExport = () => {
    if (exportOptions.tableSelection === 'custom' && exportOptions.selectedTables.length === 0) {
      setResult({
        success: false,
        message: 'Debe seleccionar al menos una tabla para exportar'
      });
      return;
    }

    exportMutation.mutate(exportOptions);
  };

  const toggleTableSelection = (tableName: string) => {
    setExportOptions(prev => ({
      ...prev,
      selectedTables: prev.selectedTables.includes(tableName)
        ? prev.selectedTables.filter(t => t !== tableName)
        : [...prev.selectedTables, tableName]
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isSuperAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo el <strong>Super Administrador</strong> puede exportar la base de datos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Exportación Completa de Base de Datos
            </h2>
            <p className="text-gray-600">
              Exportar toda la estructura y datos de la base de datos en formato SQL
            </p>
          </div>
          <div className="flex items-center">
            <Database className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-600">Exportación SQL</p>
              <p className="text-2xl font-bold text-blue-900">Completa</p>
            </div>
          </div>
        </div>

        {/* Información de seguridad */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Shield className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ Información Importante sobre Seguridad
              </h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p>• <strong>El archivo SQL contiene TODOS los datos</strong> del sistema de impresiones</p>
                <p>• <strong>Incluye información sensible:</strong> usuarios, estadísticas, configuraciones</p>
                <p>• <strong>Mantenga el archivo seguro</strong> y no lo comparta públicamente</p>
                <p>• <strong>Use para respaldos</strong> o migración a otros sistemas</p>
                <p>• <strong>El archivo se descarga directamente</strong> a su dispositivo</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Opciones de Exportación */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Opciones de Exportación
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contenido a incluir */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">
              Contenido a Incluir
            </h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSchema}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeSchema: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Esquema de tablas</strong> (CREATE TABLE)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeData}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeData: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Datos de las tablas</strong> (INSERT INTO)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeIndexes}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeIndexes: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Índices</strong> (CREATE INDEX)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeFunctions}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeFunctions: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Funciones y Triggers</strong> (CREATE FUNCTION/TRIGGER)
                </span>
              </label>
            </div>
          </div>

          {/* Selección de tablas */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">
              Selección de Tablas
            </h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tableSelection"
                  checked={exportOptions.tableSelection === 'all'}
                  onChange={() => setExportOptions(prev => ({ ...prev, tableSelection: 'all' }))}
                  className="border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Todas las tablas</strong>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="tableSelection"
                  checked={exportOptions.tableSelection === 'custom'}
                  onChange={() => setExportOptions(prev => ({ ...prev, tableSelection: 'custom' }))}
                  className="border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  <strong>Selección personalizada</strong>
                </span>
              </label>

              {exportOptions.tableSelection === 'custom' && (
                <div className="ml-6 space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-3">
                  {AVAILABLE_TABLES.map(table => (
                    <label key={table.name} className="flex items-start">
                      <input
                        type="checkbox"
                        checked={exportOptions.selectedTables.includes(table.name)}
                        onChange={() => toggleTableSelection(table.name)}
                        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">{table.name}</div>
                        <div className="text-xs text-gray-500">{table.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botón de exportación */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Exportando Base de Datos...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Exportar Base de Datos Completa
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`p-6 rounded-lg border-2 ${result.success
          ? 'bg-green-50 border-green-300'
          : 'bg-red-50 border-red-300'
          }`}>
          <div className="flex items-start">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 mr-4 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-lg font-semibold mb-3 ${result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                {result.message}
              </p>

              {result.success && result.fileSize && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Tamaño del Archivo</p>
                        <p className="text-xl font-bold text-gray-900">{formatFileSize(result.fileSize)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center">
                      <Database className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Registros Exportados</p>
                        <p className="text-xl font-bold text-gray-900">{result.recordCount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-purple-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Fecha de Exportación</p>
                        <p className="text-xl font-bold text-gray-900">{new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result.success && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>✅ ¡Exportación exitosa!</strong> El archivo SQL se ha descargado a su dispositivo.
                    Contiene toda la estructura y datos de la base de datos del sistema SEDCAUCA.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Información sobre la Exportación SQL
            </h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• <strong>Formato:</strong> Archivo SQL estándar compatible con PostgreSQL</p>
              <p>• <strong>Contenido:</strong> Estructura completa de tablas, datos, índices y funciones</p>
              <p>• <strong>Uso:</strong> Respaldo completo, migración o análisis de datos</p>
              <p>• <strong>Restauración:</strong> Ejecutar el archivo SQL en una base de datos PostgreSQL</p>
              <p>• <strong>Seguridad:</strong> El archivo contiene datos sensibles - manténgalo seguro</p>
              <p>• <strong>Tamaño:</strong> Depende de la cantidad de datos en el sistema</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}