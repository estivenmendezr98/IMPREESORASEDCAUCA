import React, { useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, X, Info } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    fileName: string;
    batchId: string;
    rowsProcessed: number;
    rowsSuccess: number;
    rowsFailed: number;
    errors?: Array<{ row: number; error: string }>;
  };
}

export function UploadCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setResult({
        success: false,
        message: 'Por favor selecciona un archivo CSV válido'
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      if (selectedDate) {
        formData.append('customDate', selectedDate);
      }
      formData.append('file', file);

      const response = await fetch('http://localhost:3000/api/imports/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: 'Archivo importado exitosamente',
        });

        // Invalidar queries del dashboard para que se actualicen los gráficos
        queryClient.invalidateQueries({ queryKey: ['dashboard-unified-data'] });
        queryClient.invalidateQueries({ queryKey: ['monthly-data'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Error al importar el archivo',
          stats: data.stats
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setResult({
        success: false,
        message: 'Error de conexión al servidor'
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Importar Datos de Impresiones
          </h2>
          <p className="text-gray-600">
            Sube un archivo CSV con los datos de impresiones para importarlos a la base de datos
          </p>
        </div>

        {/* Selector de fecha */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha de Importación
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Selecciona la fecha que se asignará a estos registros (determina el mes y año de los reportes).
          </p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {/* Zona de carga */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!file ? (
            <div>
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-gray-500 mb-4">
                o haz clic para seleccionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleInputChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Seleccionar Archivo
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={uploading}
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Botón de importar */}
        {file && !result && (
          <div className="mt-6">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {uploading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importando...
                </span>
              ) : (
                'Importar Archivo'
              )}
            </button>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
            <div className="flex items-start">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                  {result.message}
                </h3>

                {result.stats && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Archivo:</span>
                        <span className="ml-2 font-medium">{result.stats.fileName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Procesados:</span>
                        <span className="ml-2 font-medium">{result.stats.rowsProcessed}</span>
                      </div>
                      <div>
                        <span className="text-green-600">Exitosos:</span>
                        <span className="ml-2 font-medium">{result.stats.rowsSuccess}</span>
                      </div>
                      <div>
                        <span className="text-red-600">Fallidos:</span>
                        <span className="ml-2 font-medium">{result.stats.rowsFailed}</span>
                      </div>
                    </div>

                    {result.stats.errors && result.stats.errors.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Errores encontrados:
                        </p>
                        <div className="bg-white rounded p-3 max-h-40 overflow-y-auto">
                          {result.stats.errors.map((error, index) => (
                            <div key={index} className="text-xs text-gray-600 mb-1">
                              Fila {error.row}: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {result.success && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Actualizar Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Formato del archivo CSV:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Separador: punto y coma (;)</li>
                <li>Debe incluir encabezados en la primera fila</li>
                <li>Columnas requeridas: ID de la cuenta, Estado, Impresiones, Copias, etc.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}