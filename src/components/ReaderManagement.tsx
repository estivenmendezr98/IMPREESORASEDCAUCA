import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  User,
  Edit3,
  Save,
  X,
  EyeOff,
  Mail,
  AlertCircle,
  CheckCircle,
  Plus,
  UserPlus,
  Trash2,
  UserX,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';

interface ReaderUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

interface EditingReader {
  id: string;
  email: string;
  full_name: string;
  newPassword?: string;
  isEditing: boolean;
}

interface NewReader {
  email: string;
  full_name: string;
  password: string;
}

interface UpdateResult {
  success: boolean;
  message: string;
}

interface CreateResult {
  success: boolean;
  message: string;
  userId?: string;
}

interface DeleteResult {
  success: boolean;
  message: string;
}

export function ReaderManagement() {
  const { canModify } = useAuth();
  const [editingReaders, setEditingReaders] = useState<{ [key: string]: EditingReader }>({});
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [updateResults, setUpdateResults] = useState<{ [key: string]: UpdateResult }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ [key: string]: DeleteResult }>({});
  const [readerToDelete, setReaderToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newReader, setNewReader] = useState<NewReader>({
    email: '',
    full_name: '',
    password: ''
  });

  const queryClient = useQueryClient();

  // Query para obtener usuarios lectores
  const { data: readerUsers, isLoading: readersLoading } = useQuery({
    queryKey: ['reader-users'],
    queryFn: async () => {
      try {
        const users = await apiClient.getReaders();
        return users as ReaderUser[];
      } catch (error) {
        console.error('Error obteniendo usuarios reader:', error);
        throw error;
      }
    },
    enabled: canModify()
  });

  // Mutation para crear nuevo lector
  const createReaderMutation = useMutation({
    mutationFn: async (readerData: NewReader): Promise<CreateResult> => {
      try {
        const response = await apiClient.createUser({
          ...readerData,
          role: 'reader'
        });

        return {
          success: true,
          message: 'Usuario lector creado correctamente',
          userId: response.user?.id
        };

      } catch (error) {
        console.error('Error creando lector:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result) => {
      setCreateResult(result);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['reader-users'] });
        setNewReader({
          email: '',
          full_name: '',
          password: ''
        });

        setTimeout(() => {
          setCreateResult(null);
          setShowCreateForm(false);
        }, 3000);
      }
    }
  });

  // Mutation para actualizar usuario lector
  const updateReaderMutation = useMutation({
    mutationFn: async (readerData: EditingReader): Promise<UpdateResult> => {
      try {
        await apiClient.updateUser(readerData.id, {
          email: readerData.email,
          full_name: readerData.full_name
        });

        return { success: true, message: 'Usuario lector actualizado' };
      } catch (error) {
        console.error('Error actualizando lector:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result, variables) => {
      setUpdateResults(prev => ({
        ...prev,
        [variables.id]: result
      }));

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['reader-users'] });
        cancelEditing(variables.id);

        setTimeout(() => {
          setUpdateResults(prev => {
            const newResults = { ...prev };
            delete newResults[variables.id];
            return newResults;
          });
        }, 5000);
      }
    }
  });

  // Mutation para eliminar lector
  const deleteReaderMutation = useMutation({
    mutationFn: async (readerId: string): Promise<DeleteResult> => {
      try {
        await apiClient.deleteUser(readerId);
        return { success: true, message: 'Usuario lector eliminado' };
      } catch (error) {
        console.error('Error eliminando lector:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result, readerId) => {
      setDeleteResult(prev => ({
        ...prev,
        [readerId]: result
      }));

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['reader-users'] });
        setShowDeleteConfirm(false);
        setReaderToDelete(null);

        setTimeout(() => {
          setDeleteResult(prev => {
            const newResults = { ...prev };
            delete newResults[readerId];
            return newResults;
          });
        }, 5000);
      }
    }
  });

  const startEditing = (reader: ReaderUser) => {
    setEditingReaders(prev => ({
      ...prev,
      [reader.id]: {
        id: reader.id,
        email: reader.email,
        full_name: reader.full_name || '',
        newPassword: '',
        isEditing: true
      }
    }));

    // Limpiar resultado anterior
    setUpdateResults(prev => {
      const newResults = { ...prev };
      delete newResults[reader.id];
      return newResults;
    });
  };

  const cancelEditing = (readerId: string) => {
    setEditingReaders(prev => {
      const newState = { ...prev };
      delete newState[readerId];
      return newState;
    });

    setShowPasswords(prev => {
      const newState = { ...prev };
      delete newState[readerId];
      return newState;
    });
  };

  const saveReader = async (readerId: string) => {
    const editingReader = editingReaders[readerId];
    if (!editingReader) return;

    // Validaciones
    if (!editingReader.email || !editingReader.full_name) {
      setUpdateResults(prev => ({
        ...prev,
        [readerId]: {
          success: false,
          message: 'Email y nombre completo son obligatorios'
        }
      }));
      return;
    }

    if (editingReader.newPassword && editingReader.newPassword.length < 6) {
      setUpdateResults(prev => ({
        ...prev,
        [readerId]: {
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        }
      }));
      return;
    }

    await updateReaderMutation.mutateAsync(editingReader);
  };

  const updateEditingReader = (readerId: string, field: keyof EditingReader, value: string) => {
    setEditingReaders(prev => ({
      ...prev,
      [readerId]: {
        ...prev[readerId],
        [field]: value
      }
    }));
  };

  const togglePasswordVisibility = (readerId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [readerId]: !prev[readerId]
    }));
  };

  const handleCreateReader = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!newReader.email || !newReader.full_name || !newReader.password) {
      setCreateResult({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
      return;
    }

    if (newReader.password.length < 6) {
      setCreateResult({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    await createReaderMutation.mutateAsync(newReader);
  };

  const handleDeleteReader = (readerId: string) => {
    // const readerToDeleteData = readerUsers?.find(reader => reader.id === readerId);

    setReaderToDelete(readerId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReader = async () => {
    if (!readerToDelete) return;
    await deleteReaderMutation.mutateAsync(readerToDelete);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  if (!canModify()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo los administradores pueden gestionar usuarios lectores.
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
              Gestión de Usuarios Lectores
            </h2>
            <p className="text-gray-600">
              Administrar usuarios con permisos de solo lectura (separados de usuarios de impresiones y administradores)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-600">Lectores Activos</p>
                <p className="text-2xl font-bold text-blue-900">
                  {readerUsers?.length || 0}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Usuario Lector
            </button>
          </div>
        </div>

        {/* Información sobre usuarios lectores */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Eye className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Información sobre Usuarios Lectores
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Solo lectura:</strong> Pueden ver dashboards, reportes y estadísticas</p>
                <p>• <strong>Sin permisos de modificación:</strong> No pueden subir CSV, editar usuarios o gestionar el sistema</p>
                <p>• <strong>Separados completamente:</strong> No aparecen en usuarios de impresiones ni son administradores</p>
                <p>• <strong>Acceso limitado:</strong> Solo pueden consultar información, no modificar datos</p>
                <p>• <strong>Ideal para:</strong> Supervisores, auditores o personal que necesita consultar información</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Creación de Lector */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Crear Nuevo Usuario Lector
            </h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setCreateResult(null);
                setNewReader({ email: '', full_name: '', password: '' });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreateReader} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newReader.full_name}
                  onChange={(e) => setNewReader(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Usuario Lector"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={newReader.email}
                  onChange={(e) => setNewReader(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="lector@sedcauca.gov.co"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={newReader.password}
                    onChange={(e) => setNewReader(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                  >
                    {showCreatePassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  La contraseña debe tener al menos 6 caracteres.
                </p>
              </div>
            </div>

            {/* Resultado de creación */}
            {createResult && (
              <div className={`p-3 rounded-lg border ${createResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-start">
                  {createResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${createResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {createResult.message}
                  </p>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateResult(null);
                  setNewReader({ email: '', full_name: '', password: '' });
                }}
                disabled={createReaderMutation.isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createReaderMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createReaderMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Creando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Usuario Lector
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Usuarios Lectores */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Usuarios Lectores ({readerUsers?.length || 0})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Usuarios con permisos de solo lectura - separados de usuarios de impresiones y administradores
          </p>
        </div>

        {readersLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : readerUsers && readerUsers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {readerUsers.map((reader) => {
              const isEditing = editingReaders[reader.id]?.isEditing;
              const editingReader = editingReaders[reader.id];
              const showPassword = showPasswords[reader.id];
              const updateResult = updateResults[reader.id];
              const deleteResultForReader = deleteResult[reader.id];

              return (
                <div key={reader.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {reader.full_name || 'Sin nombre'}
                          </h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Eye className="h-3 w-3 mr-1" />
                            Solo Lectura
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            {/* Formulario de edición */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nombre Completo *
                                </label>
                                <input
                                  type="text"
                                  value={editingReader.full_name}
                                  onChange={(e) => updateEditingReader(reader.id, 'full_name', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Nombre completo"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Email *
                                </label>
                                <input
                                  type="email"
                                  value={editingReader.email}
                                  onChange={(e) => updateEditingReader(reader.id, 'email', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="email@empresa.com"
                                  required
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Nueva Contraseña (opcional)
                                </label>
                                <div className="relative">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={editingReader.newPassword || ''}
                                    onChange={(e) => updateEditingReader(reader.id, 'newPassword', e.target.value)}
                                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Dejar vacío para mantener la actual"
                                    minLength={6}
                                  />
                                  <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => togglePasswordVisibility(reader.id)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Mínimo 6 caracteres. Dejar vacío para no cambiar la contraseña.
                                </p>
                              </div>
                            </div>

                            {/* Resultado de actualización */}
                            {updateResult && (
                              <div className={`p-3 rounded-lg border ${updateResult.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                                }`}>
                                <div className="flex items-start">
                                  {updateResult.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                                  )}
                                  <p className={`text-sm ${updateResult.success ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {updateResult.message}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => cancelEditing(reader.id)}
                                disabled={updateReaderMutation.isPending}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => saveReader(reader.id)}
                                disabled={updateReaderMutation.isPending}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {updateReaderMutation.isPending ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Guardando...
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <Save className="h-4 w-4 mr-2" />
                                    Guardar Cambios
                                  </div>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-4 w-4 mr-2" />
                              {reader.email}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
                              Último acceso: {formatDate(reader.last_sign_in_at)}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <User className="h-4 w-4 mr-2" />
                              Creado: {formatDate(reader.created_at)}
                            </div>
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              <p className="text-xs text-blue-700">
                                <strong>Permisos:</strong> Solo lectura - puede ver dashboards y reportes, no puede modificar datos
                              </p>
                            </div>

                            {/* Mostrar resultado de eliminación si existe */}
                            {deleteResultForReader && (
                              <div className={`p-3 rounded-lg border ${deleteResultForReader.success
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                                }`}>
                                <div className="flex items-start">
                                  {deleteResultForReader.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                                  )}
                                  <p className={`text-sm ${deleteResultForReader.success ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {deleteResultForReader.message}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(reader)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteReader(reader.id)}
                          className="inline-flex items-center px-3 py-2 border border-red-300 text-red-700 text-sm font-medium rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron usuarios lectores
            </h3>
            <p className="text-gray-600">
              No hay usuarios con permisos de solo lectura en el sistema.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && readerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <UserX className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Confirmar Eliminación
                  </h3>
                  <p className="text-sm text-gray-600">
                    Esta acción no se puede deshacer
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  ¿Estás seguro de que deseas eliminar al usuario lector{' '}
                  <strong>
                    {readerUsers?.find(reader => reader.id === readerToDelete)?.full_name ||
                      readerUsers?.find(reader => reader.id === readerToDelete)?.email}
                  </strong>?
                </p>
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>⚠️ Advertencia:</strong> El usuario lector perderá inmediatamente el acceso al sistema.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setReaderToDelete(null);
                  }}
                  disabled={deleteReaderMutation.isPending}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteReader}
                  disabled={deleteReaderMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteReaderMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Eliminando...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Usuario Lector
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}