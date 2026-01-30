import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Download,
  Search,
  Clock,
  User,
  Database,
  TrendingUp,
  Eye,
  RefreshCw,
  X,
  Edit3,
  Trash2
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ImportLogEntry {
  id: string;
  file_name: string;
  batch_id: string;
  imported_at: string;
  rows_processed: number;
  rows_success: number;
  rows_failed: number;
  error_details: any;
  imported_by: string | null;
  importer_email?: string;
  importer_name?: string;
}

interface ImportStats {
  total_imports: number;
  total_files: number;
  total_rows_processed: number;
  total_rows_success: number;
  total_rows_failed: number;
  success_rate: number;
  last_import: string | null;
  first_import: string | null;
}

interface DateChangeResult {
  success: boolean;
  message: string;
  recordsUpdated?: number;
  monthlyRecordsUpdated?: number;
}

interface DeleteResult {
  success: boolean;
  message: string;
  recordsDeleted?: number;
}
export function ImportHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedImport, setSelectedImport] = useState<ImportLogEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [dateChangeResult, setDateChangeResult] = useState<DateChangeResult | null>(null);
  const [changingDate, setChangingDate] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  const [deletingImport, setDeletingImport] = useState(false);
  const [importToDelete, setImportToDelete] = useState<{ id: string; fileName: string; batchId: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Query para obtener historial de importaciones
  const { data: importHistory, isLoading: historyLoading, refetch } = useQuery({
    queryKey: ['import-history'],
    queryFn: async () => {
      const logs = await apiClient.getImportLog();

      return logs.map(item => ({
        ...item,
        importer_email: item.importer_email || 'Sistema',
        importer_name: item.importer_name || 'Sistema'
      })) as ImportLogEntry[];
    },
  });

  // Query para estadísticas de importación
  const { data: importStats } = useQuery({
    queryKey: ['import-stats'],
    queryFn: async () => {
      if (!importHistory) return null;

      const totalImports = importHistory.length;
      const totalFiles = new Set(importHistory.map(i => i.file_name)).size;
      const totalRowsProcessed = importHistory.reduce((sum, i) => sum + i.rows_processed, 0);
      const totalRowsSuccess = importHistory.reduce((sum, i) => sum + i.rows_success, 0);
      const totalRowsFailed = importHistory.reduce((sum, i) => sum + i.rows_failed, 0);
      const successRate = totalRowsProcessed > 0 ? (totalRowsSuccess / totalRowsProcessed) * 100 : 0;

      const dates = importHistory.map(i => new Date(i.imported_at)).sort((a, b) => a.getTime() - b.getTime());
      const firstImport = dates.length > 0 ? dates[0].toISOString() : null;
      const lastImport = dates.length > 0 ? dates[dates.length - 1].toISOString() : null;

      return {
        total_imports: totalImports,
        total_files: totalFiles,
        total_rows_processed: totalRowsProcessed,
        total_rows_success: totalRowsSuccess,
        total_rows_failed: totalRowsFailed,
        success_rate: successRate,
        first_import: firstImport,
        last_import: lastImport
      } as ImportStats;
    },
    enabled: !!importHistory
  });

  // Filtrar importaciones
  const filteredImports = importHistory?.filter(item => {
    const matchesSearch = !searchTerm ||
      item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.importer_email && item.importer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.importer_name && item.importer_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const importDate = new Date(item.imported_at);
    const now = new Date();

    switch (filterPeriod) {
      case 'today':
        return importDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return importDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return importDate >= monthAgo;
      case 'all':
      default:
        return true;
    }
  }) || [];

  const exportHistoryToCSV = () => {
    if (!filteredImports.length) return;

    const headers = [
      'Archivo',
      'Fecha de Importación',
      'Registros Procesados',
      'Registros Exitosos',
      'Registros Fallidos',
      'Tasa de Éxito (%)',
      'Importado Por (Nombre)',
      'Importado Por (Email)',
      'ID de Lote'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredImports.map(item => [
        `"${item.file_name}"`,
        `"${format(new Date(item.imported_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}"`,
        item.rows_processed,
        item.rows_success,
        item.rows_failed,
        item.rows_processed > 0 ? ((item.rows_success / item.rows_processed) * 100).toFixed(1) : '0',
        `"${item.importer_name || 'Sistema'}"`,
        `"${item.importer_email || 'Sistema'}"`,
        `"${item.batch_id}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historial_importaciones_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Función para cambiar fecha de importación (Deshabilitada en local para esta fase, requiere implementación backend)
  const changeBatchDate = async (_batchId: string, _newImportDate: string) => {
    // Note: Esta función requiere un nuevo endpoint en el backend para realizar la migración de fechas
    // de forma segura dentro de una transacción.
    alert('La función de cambiar fecha no está disponible actualmente en la versión local.');
    setChangingDate(false);
  };

  const startEditingDate = (importEntry: ImportLogEntry) => {
    setEditingDate(importEntry.batch_id);
    setNewDate(format(new Date(importEntry.imported_at), 'yyyy-MM-dd'));
    setDateChangeResult(null);
  };

  const cancelEditingDate = () => {
    setEditingDate(null);
    setNewDate('');
    setDateChangeResult(null);
  };

  const saveNewDate = async (batchId: string) => {
    if (!newDate) {
      setDateChangeResult({
        success: false,
        message: 'Por favor seleccione una fecha válida'
      });
      return;
    }

    await changeBatchDate(batchId, newDate);

    // Solo cerrar el modal si la operación fue exitosa
    setTimeout(() => {
      if (dateChangeResult?.success) {
        setEditingDate(null);
        setNewDate('');
      }
    }, 2000);
  };

  // Función para eliminar importación
  const deleteImportBatch = async (importId: string, batchId: string) => {
    setDeletingImport(true);
    setDeleteResult(null);

    try {
      console.log(`🗑️ Eliminando importación ${importId} con lote ${batchId}...`);

      const response = await apiClient.deleteImport(batchId);

      setDeleteResult({
        success: true,
        message: `✅ Importación eliminada exitosamente`,
        recordsDeleted: response.rawDeleted
      });

      // Refrescar datos
      refetch();

    } catch (error) {
      console.error('Error eliminando importación:', error);
      setDeleteResult({
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setDeletingImport(false);
    }
  };

  const handleDeleteImport = (importId: string, fileName: string, batchId: string) => {
    setImportToDelete({ id: importId, fileName, batchId });
    setShowDeleteConfirm(true);
    setDeleteResult(null);
  };

  const confirmDeleteImport = async () => {
    if (!importToDelete) return;

    try {
      await deleteImportBatch(importToDelete.id, importToDelete.batchId);
      setShowDeleteConfirm(false);
      setImportToDelete(null);
    } catch (error) {
      console.error('Error confirming delete:', error);
    }
  };

  const cancelDeleteImport = () => {
    setShowDeleteConfirm(false);
    setImportToDelete(null);
    setDeleteResult(null);
  };
  const getSuccessRate = (processed: number, success: number) => {
    if (processed === 0) return 0;
    return ((success / processed) * 100);
  };

  const getStatusColor = (processed: number, success: number, failed: number) => {
    const rate = getSuccessRate(processed, success);
    if (rate === 100) return 'text-green-600 bg-green-100';
    if (rate >= 90) return 'text-yellow-600 bg-yellow-100';
    if (failed > 0) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  if (historyLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm h-32"></div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header y Estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Historial de Importaciones CSV
            </h2>
            <p className="text-gray-600">
              Registro completo de todas las importaciones realizadas en el sistema con información del usuario
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </button>
            <button
              onClick={exportHistoryToCSV}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Historial
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {importStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Total Importaciones</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {importStats.total_imports.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Registros Exitosos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {importStats.total_rows_success.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {importStats.success_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Archivos Únicos</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {importStats.total_files.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Importación
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Archivo, lote, usuario..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterPeriod('all');
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Modales fuera del grid para evitar problemas de layout */}
      {editingDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Cambiar Fecha de Importación
                </h3>
                <button
                  onClick={cancelEditingDate}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nueva Fecha de Importación
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Los datos se reasignarán a esta fecha manteniendo la hora original
                </p>
              </div>

              {dateChangeResult && (
                <div className={`mb-4 p-3 rounded-lg border ${dateChangeResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-start">
                    {dateChangeResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm ${dateChangeResult.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                        {dateChangeResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelEditingDate}
                  disabled={changingDate}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => saveNewDate(editingDate!)}
                  disabled={changingDate}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {changingDate ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && importToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Confirmar Eliminación
                </h3>
                <button
                  onClick={cancelDeleteImport}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    Eliminar Importación
                  </h4>
                  <p className="text-sm text-gray-600">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  ¿Estás seguro de que deseas eliminar la importación del archivo{' '}
                  <strong>"{importToDelete.fileName}"</strong>?
                </p>
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>⚠️ Advertencia:</strong> Esto eliminará:
                  </p>
                  <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                    <li>Todos los registros raw de esta importación</li>
                    <li>El log de importación del historial</li>
                    <li>Los datos no se podrán recuperar</li>
                  </ul>
                </div>
              </div>

              {deleteResult && (
                <div className={`mb-4 p-3 rounded-lg border ${deleteResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-start">
                    {deleteResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm ${deleteResult.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                        {deleteResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDeleteImport}
                  disabled={deletingImport}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteImport}
                  disabled={deletingImport}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingImport ? 'Eliminando...' : 'Eliminar Importación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Historial */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Historial de Importaciones ({filteredImports.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Importación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Éxito/Fallo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Importado Por
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredImports.map((item) => {
                const successRate = getSuccessRate(item.rows_processed, item.rows_success);
                const statusColor = getStatusColor(item.rows_processed, item.rows_success, item.rows_failed);

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {successRate === 100 ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : item.rows_failed > 0 ? (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {successRate.toFixed(0)}% éxito
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.file_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {item.batch_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(item.imported_at), 'dd/MM/yyyy', { locale: es })}
                          </div>
                          <div className="text-gray-500">
                            {format(new Date(item.imported_at), 'HH:mm:ss', { locale: es })}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">
                          {item.rows_processed.toLocaleString()} total
                        </div>
                        <div className="text-gray-500">
                          procesados
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-green-600 font-medium">
                          ✓ {item.rows_success.toLocaleString()}
                        </div>
                        {item.rows_failed > 0 && (
                          <div className="text-red-600">
                            ✗ {item.rows_failed.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {item.importer_name || 'Sistema'}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {item.importer_email || 'Sistema'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedImport(item);
                            setShowDetails(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Ver detalles completos"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => startEditingDate(item)}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                          title="Cambiar fecha de importación"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteImport(item.id, item.file_name, item.batch_id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Eliminar importación"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredImports.length === 0 && (
          <div className="p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron importaciones
            </h3>
            <p className="text-gray-600">
              {importHistory?.length === 0
                ? 'Aún no se han realizado importaciones de CSV.'
                : 'Ajusta los filtros para ver más resultados.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de Detalles */}
      {showDetails && selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Detalles de Importación
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Información del Archivo
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Nombre:</span>
                      <span className="ml-2 font-medium">{selectedImport.file_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID de Lote:</span>
                      <span className="ml-2 font-mono text-xs">{selectedImport.batch_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <span className="ml-2">
                        {format(new Date(selectedImport.imported_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Usuario que Importó
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Nombre:</span>
                      <span className="ml-2 font-medium">{selectedImport.importer_name || 'Sistema'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2">{selectedImport.importer_email || 'Sistema'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID Usuario:</span>
                      <span className="ml-2 font-mono text-xs">{selectedImport.imported_by || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Estadísticas de Procesamiento
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Total procesados:</span>
                      <span className="ml-2 font-medium">{selectedImport.rows_processed.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Exitosos:</span>
                      <span className="ml-2 text-green-600 font-medium">{selectedImport.rows_success.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fallidos:</span>
                      <span className="ml-2 text-red-600 font-medium">{selectedImport.rows_failed.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tasa de éxito:</span>
                      <span className="ml-2 font-medium">
                        {getSuccessRate(selectedImport.rows_processed, selectedImport.rows_success).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedImport.error_details &&
                ((Array.isArray(selectedImport.error_details) && selectedImport.error_details.length > 0) ||
                  (!Array.isArray(selectedImport.error_details) && Object.keys(selectedImport.error_details).length > 0)) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Detalles de Errores ({Array.isArray(selectedImport.error_details) ? selectedImport.error_details.length : 1})
                    </h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      {Array.isArray(selectedImport.error_details) ? (
                        <ul className="list-disc list-inside text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                          {selectedImport.error_details.map((err: any, idx: number) => (
                            <li key={idx} className="break-words">
                              {typeof err === 'object' ? JSON.stringify(err) : String(err)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <pre className="text-xs text-red-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {JSON.stringify(selectedImport.error_details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Información sobre cambio de fechas */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <Calendar className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900 mb-2">
              📅 Cambio de Fecha de Importación
            </h4>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• <strong>Función disponible:</strong> Cambiar fecha de importación de lotes CSV existentes</p>
              <p>• <strong>Proceso:</strong> Actualiza registros raw, agregados mensuales y log de importación</p>
              <p>• <strong>Hora preservada:</strong> Se mantiene la hora original del CSV</p>
              <p>• <strong>Recálculo automático:</strong> Diferencias mensuales se actualizan</p>
              <p>• <strong>Uso típico:</strong> Corregir datos importados con fecha incorrecta</p>
              <p>• <strong>⚠️ Importante:</strong> Esta operación afecta estadísticas y reportes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}