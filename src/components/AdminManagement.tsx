import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  User,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  CheckCircle,
  Crown,
  UserCheck,
  Lock,
  Plus,
  UserPlus,
  Trash2,
  UserX
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
}

interface EditingAdmin {
  id: string;
  email: string;
  full_name: string;
  newPassword?: string;
  role?: string;
  isEditing: boolean;
}

interface NewAdmin {
  email: string;
  full_name: string;
  password: string;
  role: 'admin' | 'superadmin';
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

export function AdminManagement() {
  const { isSuperAdmin, user } = useAuth();
  const [editingAdmins, setEditingAdmins] = useState<{ [key: string]: EditingAdmin }>({});
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [updateResults, setUpdateResults] = useState<{ [key: string]: UpdateResult }>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ [key: string]: DeleteResult }>({});
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newAdmin, setNewAdmin] = useState<NewAdmin>({
    email: '',
    full_name: '',
    password: '',
    role: 'admin'
  });

  const queryClient = useQueryClient();

  // Query para obtener usuarios administradores
  const { data: adminUsers, isLoading: adminsLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const users = await apiClient.getAdmins();
        return users as AdminUser[];
      } catch (error) {
        console.error('Error obteniendo usuarios admin:', error);
        throw error;
      }
    },
    enabled: isSuperAdmin()
  });

  // Mutation para crear nuevo administrador
  const createAdminMutation = useMutation({
    mutationFn: async (adminData: NewAdmin): Promise<CreateResult> => {
      try {
        const response = await apiClient.createUser({
          ...adminData,
          role: adminData.role // Pass the selected role
        });

        return {
          success: true,
          message: `${adminData.role === 'superadmin' ? 'Super ' : ''}Administrador creado correctamente`,
          userId: response.user?.id
        };

      } catch (error) {
        console.error('Error creando admin:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result) => {
      setCreateResult(result);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        // Limpiar formulario
        setNewAdmin({
          email: '',
          full_name: '',
          password: '',
          role: 'admin'
        });

        // Limpiar resultado después de 3 segundos
        setTimeout(() => {
          setCreateResult(null);
          setShowCreateForm(false);
        }, 3000);
      }
    }
  });

  // Mutation para actualizar usuario administrador
  const updateAdminMutation = useMutation({
    mutationFn: async (adminData: EditingAdmin): Promise<UpdateResult> => {
      try {
        await apiClient.updateUser(adminData.id, {
          email: adminData.email,
          full_name: adminData.full_name,
          role: adminData.role,
          ...(adminData.newPassword ? { password: adminData.newPassword } : {})
        } as any);

        return { success: true, message: 'Administrador actualizado' };
      } catch (error) {
        console.error('Error actualizando admin:', error);
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
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  // Mutation para eliminar administrador
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string): Promise<DeleteResult> => {
      try {
        await apiClient.deleteUser(adminId);
        return { success: true, message: 'Administrador eliminado' };
      } catch (error) {
        console.error('Error eliminando admin:', error);
        return {
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }
    },
    onSuccess: (result, adminId) => {
      setDeleteResult(prev => ({
        ...prev,
        [adminId]: result
      }));

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        setShowDeleteConfirm(false);
        setAdminToDelete(null);

        setTimeout(() => {
          setDeleteResult(prev => {
            const newResults = { ...prev };
            delete newResults[adminId];
            return newResults;
          });
        }, 5000);
      }
    }
  });

  const startEditing = (admin: AdminUser) => {
    setEditingAdmins(prev => ({
      ...prev,
      [admin.id]: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name || '',
        newPassword: '',
        role: admin.role,
        isEditing: true
      }
    }));

    setUpdateResults(prev => {
      const newResults = { ...prev };
      delete newResults[admin.id];
      return newResults;
    });
  };

  const cancelEditing = (adminId: string) => {
    setEditingAdmins(prev => {
      const newState = { ...prev };
      delete newState[adminId];
      return newState;
    });

    setShowPasswords(prev => {
      const newState = { ...prev };
      delete newState[adminId];
      return newState;
    });
  };

  const saveAdmin = async (adminId: string) => {
    const editingAdmin = editingAdmins[adminId];
    if (!editingAdmin) return;

    // Validaciones
    if (!editingAdmin.email || !editingAdmin.full_name) {
      setUpdateResults(prev => ({
        ...prev,
        [adminId]: {
          success: false,
          message: 'Email y nombre completo son obligatorios'
        }
      }));
      return;
    }

    if (editingAdmin.newPassword && editingAdmin.newPassword.length < 6) {
      setUpdateResults(prev => ({
        ...prev,
        [adminId]: {
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        }
      }));
      return;
    }

    await updateAdminMutation.mutateAsync(editingAdmin);
  };

  const updateEditingAdmin = (adminId: string, field: keyof EditingAdmin, value: string) => {
    setEditingAdmins(prev => ({
      ...prev,
      [adminId]: {
        ...prev[adminId],
        [field]: value
      }
    }));
  };

  const togglePasswordVisibility = (adminId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newAdmin.email || !newAdmin.full_name || !newAdmin.password) {
      setCreateResult({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
      return;
    }

    if (newAdmin.password.length < 6) {
      setCreateResult({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    await createAdminMutation.mutateAsync(newAdmin);
  };

  const handleDeleteAdmin = (adminId: string) => {
    if (adminId === user?.id) {
      setDeleteResult(prev => ({
        ...prev,
        [adminId]: {
          success: false,
          message: 'No puedes eliminar tu propia cuenta de administrador'
        }
      }));
      return;
    }

    setAdminToDelete(adminId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    await deleteAdminMutation.mutateAsync(adminToDelete);
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

  if (!isSuperAdmin()) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <p className="text-red-700">
            Solo el <strong>Super Administrador</strong> puede gestionar otros administradores.
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
              Gestión de Administradores
            </h2>
            <p className="text-gray-600">
              Administrar usuarios con permisos de administrador o super administrador
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-600">Administradores Activos</p>
                <p className="text-2xl font-bold text-purple-900">
                  {adminUsers?.length || 0}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Administrador
            </button>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start">
            <Lock className="h-5 w-5 text-purple-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-purple-900 mb-2">
                Información Importante
              </h4>
              <div className="text-sm text-purple-700 space-y-1">
                <p>• <strong>Super Administradores</strong> tienen acceso total y pueden crear otros administradores.</p>
                <p>• <strong>Administradores</strong> pueden gestionar usuarios de impresiones pero no otros admins.</p>
                <p>• <strong>Todos</strong> están completamente separados de usuarios de impresiones.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Creación */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Crear Nuevo Administrador
            </h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setCreateResult(null);
                setNewAdmin({ email: '', full_name: '', password: '', role: 'admin' });
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreateAdmin} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newAdmin.full_name}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Juan Pérez García"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@sedcauca.gov.co"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol del Sistema *
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin(prev => ({ ...prev, role: e.target.value as 'admin' | 'superadmin' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="admin">Administrador (Gestión Impresiones)</option>
                  <option value="superadmin">Super Administrador (Control Total)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {newAdmin.role === 'superadmin'
                    ? '⚠️ Acceso total: Gestión de admins, backups y reportes globales.'
                    : 'Acceso estándar: Gestión de usuarios e impresiones.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              </div>
            </div>

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

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateResult(null);
                  setNewAdmin({ email: '', full_name: '', password: '', role: 'admin' });
                }}
                disabled={createAdminMutation.isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createAdminMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {createAdminMutation.isPending ? 'Creando...' : 'Crear Administrador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Administradores */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Usuarios Administradores ({adminUsers?.length || 0})
          </h3>
        </div>

        {adminsLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : adminUsers && adminUsers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {adminUsers.map((admin) => {
              const isEditing = editingAdmins[admin.id]?.isEditing;
              const editingAdmin = editingAdmins[admin.id];
              const showPassword = showPasswords[admin.id];
              const isCurrentUser = admin.id === user?.id;
              const isSuper = admin.role === 'superadmin';

              return (
                <div key={admin.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">

                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isSuper ? 'bg-yellow-100' : 'bg-purple-100'}`}>
                        {isSuper ? (
                          <Crown className="h-6 w-6 text-yellow-600" />
                        ) : (
                          <Shield className="h-6 w-6 text-purple-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {admin.full_name || 'Sin nombre'}
                          </h4>
                          {isCurrentUser && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Tú
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSuper ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                            }`}>
                            <Shield className="h-3 w-3 mr-1" />
                            {isSuper ? 'Super Admin' : 'Admin'}
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                  type="text"
                                  value={editingAdmin.full_name}
                                  onChange={(e) => updateEditingAdmin(admin.id, 'full_name', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-md"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                  type="email"
                                  value={editingAdmin.email}
                                  onChange={(e) => updateEditingAdmin(admin.id, 'email', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-md"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select
                                  value={editingAdmin.role}
                                  onChange={(e) => updateEditingAdmin(admin.id, 'role', e.target.value)}
                                  className="w-full px-3 py-2 border rounded-md"
                                // Prevent downgrading oneself if desired, but allowed for flexibility
                                >
                                  <option value="admin">Administrador</option>
                                  <option value="superadmin">Super Administrador</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                                <div className="relative">
                                  <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={editingAdmin.newPassword || ''}
                                    onChange={(e) => updateEditingAdmin(admin.id, 'newPassword', e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md pr-10"
                                    placeholder="Opcional"
                                  />
                                  <button type="button" onClick={() => togglePasswordVisibility(admin.id)} className="absolute right-2 top-2.5">
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end space-x-2">
                              <button onClick={() => cancelEditing(admin.id)} className="px-3 py-1 border rounded">Cancelar</button>
                              <button onClick={() => saveAdmin(admin.id)} className="px-3 py-1 bg-blue-600 text-white rounded">Guardar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 space-y-1">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2" /> {admin.email}
                            </div>
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" /> Creado: {formatDate(admin.created_at)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button onClick={() => startEditing(admin)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                          <Edit3 className="h-5 w-5" />
                        </button>
                        {/* Only allow deleting if not current user */}
                        {!isCurrentUser && (
                          <button onClick={() => handleDeleteAdmin(admin.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">No hay administradores registrados.</div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Confirmar Eliminación</h3>
            <p className="mb-4">¿Estás seguro de que deseas eliminar este administrador? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border rounded">Cancelar</button>
              <button onClick={confirmDeleteAdmin} className="px-4 py-2 bg-red-600 text-white rounded">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}