import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Users,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Crown
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface ConvertResult {
  success: boolean;
  message: string;
  converted: string[];
  errors: string[];
}

export function ConvertUsersToAdmins() {
  const { isAdmin } = useAuth();
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const queryClient = useQueryClient();

  // IDs de usuarios que se crearon mal como usuarios de impresiones
  const misplacedUserIds = ['daniel2078', 'daniel24165', 'isabel6268', 'Other'];

  // Mutation para convertir usuarios a administradores
  const convertMutation = useMutation({
    mutationFn: async (userIds: string[]): Promise<ConvertResult> => {
      const converted: string[] = [];
      const errors: string[] = [];

      try {
        for (const userId of userIds) {
          try {
            await apiClient.updateUser(userId, { role: 'admin' });
            converted.push(userId);
          } catch (err) {
            console.error(`Error converting user ${userId}:`, err);
            errors.push(`Error con ${userId}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
          }
        }

        return {
          success: errors.length === 0,
          message: errors.length === 0 ? '✅ Usuarios convertidos exitosamente' : '⚠️ Algunos usuarios no pudieron ser convertidos',
          converted,
          errors
        };

      } catch (error) {
        console.error('Error general convirtiendo usuarios:', error);
        return {
          success: false,
          message: `Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          converted,
          errors: [error instanceof Error ? error.message : 'Error desconocido']
        };
      }
    },
    onSuccess: (result) => {
      setResult(result);

      if (result.success) {
        // Invalidar queries para actualizar listas
        queryClient.invalidateQueries({ queryKey: ['printing-users-only'] });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.invalidateQueries({ queryKey: ['users-with-activity'] });
      }
    }
  });

  const handleConvert = async () => {
    if (confirm(`¿Está seguro de que desea convertir estos usuarios a administradores?\n\n${misplacedUserIds.join(', ')}\n\nEsto los eliminará de la lista de usuarios de impresiones y los creará como administradores.`)) {
      setIsConverting(true);
      try {
        await convertMutation.mutateAsync(misplacedUserIds);
      } finally {
        setIsConverting(false);
      }
    }
  };

  if (!isAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo los administradores pueden realizar esta operación.
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
              Convertir Usuarios a Administradores
            </h2>
            <p className="text-gray-600">
              Herramienta para corregir usuarios que se crearon incorrectamente como usuarios de impresiones
            </p>
          </div>
        </div>

        {/* Información del problema */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-2">
                Problema Detectado
              </h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p>Los siguientes usuarios se crearon incorrectamente como <strong>usuarios de impresiones</strong> cuando deberían ser <strong>administradores</strong>:</p>
                <div className="mt-2 p-2 bg-yellow-100 rounded border">
                  <ul className="list-disc list-inside space-y-1">
                    {misplacedUserIds.map(userId => (
                      <li key={userId} className="font-mono text-sm">{userId}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proceso de conversión */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Proceso de Conversión
              </h4>
              <div className="text-sm text-blue-700 space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-blue-600 mr-2" />
                    <span>Usuarios de Impresiones</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <div className="flex items-center">
                    <Crown className="h-4 w-4 text-purple-600 mr-2" />
                    <span>Administradores</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <p>• <strong>Se eliminarán</strong> de la tabla de usuarios de impresiones</p>
                  <p>• <strong>Se crearán</strong> como administradores en el sistema de autenticación</p>
                  <p>• <strong>Contraseña temporal:</strong> admin123 (deben cambiarla después)</p>
                  <p>• <strong>Email:</strong> Se mantendrá el existente o se generará uno por defecto</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de conversión */}
        <div className="flex justify-center">
          <button
            onClick={handleConvert}
            disabled={isConverting || convertMutation.isPending}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConverting || convertMutation.isPending ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Convirtiendo...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Convertir a Administradores
              </>
            )}
          </button>
        </div>

        {/* Resultado */}
        {result && (
          <div className={`mt-6 p-6 rounded-lg border-2 ${result.success
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

                {result.converted.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-green-800 mb-2">
                      ✅ Usuarios convertidos exitosamente:
                    </h4>
                    <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                      <ul className="space-y-1">
                        {result.converted.map(userId => (
                          <li key={userId} className="flex items-center text-sm text-green-700">
                            <UserCheck className="h-4 w-4 mr-2" />
                            <span className="font-mono">{userId}</span>
                            <span className="ml-2">→ Ahora es administrador</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-red-800 mb-2">
                      ❌ Errores encontrados:
                    </h4>
                    <div className="bg-red-100 rounded-lg p-3 border border-red-200">
                      <ul className="space-y-1">
                        {result.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-700">
                            • {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {result.success && result.converted.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>✅ ¡Conversión exitosa!</strong> Los usuarios ahora son administradores y pueden:
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• Iniciar sesión con su email y contraseña: <code className="bg-blue-200 px-1 rounded">admin123</code></li>
                      <li>• Acceder a todas las funciones administrativas</li>
                      <li>• Gestionar usuarios y subir archivos CSV</li>
                      <li>• <strong>Importante:</strong> Deben cambiar su contraseña después del primer login</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Información Importante
            </h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Esta operación es <strong>irreversible</strong> - los usuarios se eliminarán de la lista de impresiones</p>
              <p>• Los nuevos administradores <strong>NO aparecerán</strong> en la lista de usuarios de impresiones</p>
              <p>• Podrán acceder al panel administrativo con email y contraseña temporal</p>
              <p>• Se recomienda que cambien su contraseña después del primer acceso</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}