import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Eye,
  Building,
  Users,
  Printer,
  Copy,
  Scan,
  Clock,
  BarChart3,
  Search,
  ArrowLeft
} from 'lucide-react';
import apiClient from '../lib/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';



interface ImportLogEntry {
  id: string;
  file_name: string;
  batch_id: string;
  imported_at: string;
  rows_processed: number;
  rows_success: number;
  rows_failed: number;
}

interface CSVRowData {
  user_id: string;
  office: string;
  full_name: string;
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_operations: number;
  report_timestamp: string;
}

interface MonthData {
  month: number;
  monthName: string;
  year: number;
  fileCount: number;
  hasData: boolean;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function CalendarView() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<ImportLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');

  // Query para obtener archivos por año
  const { data: yearFiles, isLoading: yearLoading } = useQuery({
    queryKey: ['calendar-files', selectedYear],
    queryFn: async () => {
      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

      const data = await apiClient.getImportLog(
        startDate.toISOString(),
        endDate.toISOString()
      );

      // Agrupar archivos por mes
      const filesByMonth = data.reduce((acc: any, file: any) => {
        const month = new Date(file.imported_at).getMonth() + 1;
        if (!acc[month]) {
          acc[month] = [];
        }
        acc[month].push(file);
        return acc;
      }, {});

      // Crear datos de meses
      const monthsData: MonthData[] = MONTHS.map((monthName, index) => ({
        month: index + 1,
        monthName,
        year: selectedYear,
        fileCount: filesByMonth[index + 1]?.length || 0,
        hasData: (filesByMonth[index + 1]?.length || 0) > 0
      }));

      return { filesByMonth, monthsData };
    },
  });

  // Query para obtener archivos de un mes específico
  const { data: monthFiles, isLoading: monthLoading } = useQuery({
    queryKey: ['month-files', selectedYear, selectedMonth],
    queryFn: async () => {
      if (!selectedMonth) return [];

      const startDate = startOfMonth(new Date(selectedYear, selectedMonth - 1));
      const endDate = endOfMonth(new Date(selectedYear, selectedMonth - 1));

      const data = await apiClient.getImportLog(
        startDate.toISOString(),
        endDate.toISOString()
      );

      return data as ImportLogEntry[];
    },
    enabled: !!selectedMonth
  });

  // Query para obtener datos específicos de un archivo CSV
  const { data: csvData, isLoading: csvLoading } = useQuery({
    queryKey: ['csv-data', selectedFile?.batch_id],
    queryFn: async () => {
      if (!selectedFile) return [];

      const rawData = await apiClient.getImportBatch(selectedFile.batch_id);

      // Procesar y formatear datos
      const processedData = rawData.map((row: any) => ({
        user_id: row.user_id,
        office: row.users?.office || 'Sin oficina',
        full_name: row.users?.full_name || 'Sin nombre',
        total_prints: row.print_total || 0,
        total_copies: row.copy_total || 0,
        total_scans: row.scan_total || 0,
        total_operations: (row.print_total || 0) + (row.copy_total || 0) + (row.scan_total || 0),
        report_timestamp: row.report_timestamp
      })) as CSVRowData[];

      return processedData;
    },
    enabled: !!selectedFile
  });

  // Obtener oficinas únicas para filtros
  const uniqueOffices = csvData ? [...new Set(csvData.map(row => row.office))].sort() : [];

  // Filtrar datos CSV
  const filteredCSVData = csvData?.filter(row => {
    const matchesSearch = !searchTerm ||
      row.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.office.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOffice = !filterOffice || row.office === filterOffice;

    return matchesSearch && matchesOffice;
  }) || [];

  const handleYearChange = (direction: 'prev' | 'next') => {
    setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
    setSelectedMonth(null);
    setSelectedFile(null);
  };

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setSelectedFile(null);
  };

  const handleFileClick = (file: ImportLogEntry) => {
    setSelectedFile(file);
    setSearchTerm('');
    setFilterOffice('');
  };

  const exportCSVData = () => {
    if (!filteredCSVData.length || !selectedFile) return;

    const headers = [
      'ID Usuario',
      'Nombre Completo',
      'Oficina',
      'Impresiones',
      'Copias',
      'Escaneos',
      'Total Operaciones',
      'Fecha y Hora'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredCSVData.map(row => [
        row.user_id,
        `"${row.full_name}"`,
        `"${row.office}"`,
        row.total_prints,
        row.total_copies,
        row.total_scans,
        row.total_operations,
        `"${format(new Date(row.report_timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `datos_${selectedFile.file_name}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const goBack = () => {
    if (selectedFile) {
      setSelectedFile(null);
      setSearchTerm('');
      setFilterOffice('');
    } else if (selectedMonth) {
      setSelectedMonth(null);
    }
  };

  // Vista de datos específicos del CSV
  if (selectedFile) {
    return (
      <div className="space-y-6">
        {/* Header del archivo */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={goBack}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Datos del Archivo CSV
                </h2>
                <p className="text-gray-600">
                  {selectedFile.file_name} - {format(new Date(selectedFile.imported_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={exportCSVData}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Datos
              </button>
            </div>
          </div>

          {/* Información del archivo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Registros Procesados</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {selectedFile.rows_processed}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Usuarios Únicos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {csvData?.length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Oficinas</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {uniqueOffices.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Total Operaciones</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {csvData?.reduce((sum, row) => sum + row.total_operations, 0).toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos del Archivo Importado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Distribución de Operaciones
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Impresiones', value: csvData?.reduce((acc, row) => acc + row.total_prints, 0) || 0 },
                        { name: 'Copias', value: csvData?.reduce((acc, row) => acc + row.total_copies, 0) || 0 },
                        { name: 'Escaneos', value: csvData?.reduce((acc, row) => acc + row.total_scans, 0) || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#3B82F6" />
                      <Cell fill="#10B981" />
                      <Cell fill="#F59E0B" />
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top 5 Usuarios por Actividad
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={csvData
                      ?.sort((a, b) => b.total_operations - a.total_operations)
                      .slice(0, 5)
                      .map(user => ({
                        name: user.full_name,
                        value: user.total_operations
                      }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Usuario
              </label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ID, nombre u oficina..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Oficina
              </label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las oficinas</option>
                {uniqueOffices.map(office => (
                  <option key={office} value={office}>{office}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterOffice('');
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de datos del CSV */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Datos del CSV ({filteredCSVData.length} registros)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Información extraída del archivo: {selectedFile.file_name}
            </p>
          </div>

          {csvLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        Oficina
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Printer className="h-4 w-4 mr-1" />
                        Impresiones
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Copy className="h-4 w-4 mr-1" />
                        Copias
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Scan className="h-4 w-4 mr-1" />
                        Escaneos
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Total
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Fecha y Hora
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCSVData.map((row, index) => (
                    <tr key={`${row.user_id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {row.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {row.user_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{row.office}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {row.total_prints.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {row.total_copies.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600">
                        {row.total_scans.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {row.total_operations.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(row.report_timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredCSVData.length === 0 && !csvLoading && (
            <div className="p-6 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron datos
              </h3>
              <p className="text-gray-600">
                {csvData?.length === 0
                  ? 'No hay datos disponibles para este archivo.'
                  : 'Ajusta los filtros para ver más resultados.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de archivos del mes
  if (selectedMonth) {
    const monthName = MONTHS[selectedMonth - 1];

    return (
      <div className="space-y-6">
        {/* Header del mes */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={goBack}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Archivos CSV - {monthName} {selectedYear}
                </h2>
                <p className="text-gray-600">
                  Archivos importados durante este mes
                </p>
              </div>
            </div>
          </div>

          {/* Estadísticas del mes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Archivos CSV</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {monthFiles?.length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Registros Totales</p>
                  <p className="text-2xl font-bold text-green-900">
                    {monthFiles?.reduce((sum, file) => sum + file.rows_success, 0).toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {monthFiles && monthFiles.length > 0
                      ? Math.round((monthFiles.reduce((sum, file) => sum + file.rows_success, 0) /
                        monthFiles.reduce((sum, file) => sum + file.rows_processed, 0)) * 100)
                      : 0
                    }%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de archivos */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Archivos CSV Importados
            </h3>
          </div>

          {monthLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : monthFiles && monthFiles.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {monthFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleFileClick(file)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-8 w-8 text-blue-600 mr-4" />
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {file.file_name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Importado: {format(new Date(file.imported_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm text-gray-500">
                            <strong>{file.rows_success}</strong> registros exitosos
                          </span>
                          {file.rows_failed > 0 && (
                            <span className="text-sm text-red-600">
                              <strong>{file.rows_failed}</strong> fallidos
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            ID: {file.batch_id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Eye className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay archivos CSV
              </h3>
              <p className="text-gray-600">
                No se encontraron archivos importados para {monthName} {selectedYear}.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista principal del calendario
  return (
    <div className="space-y-6">
      {/* Header del calendario */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Calendario de Importaciones CSV
            </h2>
            <p className="text-gray-600">
              Navega por meses y años para ver archivos CSV importados
            </p>
          </div>

          {/* Selector de año */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleYearChange('prev')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-xl font-bold text-gray-900 min-w-[80px] text-center">
              {selectedYear}
            </div>
            <button
              onClick={() => handleYearChange('next')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Información del año */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Año Seleccionado</p>
                <p className="text-2xl font-bold text-blue-900">
                  {selectedYear}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Archivos del Año</p>
                <p className="text-2xl font-bold text-green-900">
                  {yearFiles?.monthsData.reduce((sum, month) => sum + month.fileCount, 0) || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Meses con Datos</p>
                <p className="text-2xl font-bold text-purple-900">
                  {yearFiles?.monthsData.filter(month => month.hasData).length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de meses */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Seleccionar Mes
        </h3>

        {yearLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="animate-pulse h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {yearFiles?.monthsData.map((month) => (
              <button
                key={month.month}
                onClick={() => handleMonthClick(month.month)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${month.hasData
                    ? 'border-blue-500 bg-blue-50 hover:bg-blue-100 hover:border-blue-600'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium ${month.hasData ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                    {month.monthName}
                  </h4>
                  {month.hasData && (
                    <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm ${month.hasData ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                    {month.fileCount} archivo{month.fileCount !== 1 ? 's' : ''}
                  </span>
                  {month.hasData && (
                    <FileText className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Información de uso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Calendar className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Cómo usar el Calendario de Importaciones
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Navegar años:</strong> Usa las flechas para cambiar de año</p>
              <p>• <strong>Seleccionar mes:</strong> Haz clic en cualquier mes para ver archivos CSV</p>
              <p>• <strong>Meses con datos:</strong> Aparecen resaltados en azul con un punto indicador</p>
              <p>• <strong>Ver archivo CSV:</strong> Haz clic en un archivo para ver datos específicos</p>
              <p>• <strong>Datos mostrados:</strong> Oficina, usuarios, impresiones, copias, escaneos, total y fecha exacta</p>
              <p>• <strong>Filtros disponibles:</strong> Buscar por usuario u oficina en cada archivo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}