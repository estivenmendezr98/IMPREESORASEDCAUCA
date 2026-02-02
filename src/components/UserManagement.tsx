import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewTransition, useNavigationTransition } from '../hooks/useViewTransition';
import {
  User,
  Edit3,
  Save,
  X,
  Building,
  Users,
  Search,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Shield,
  Database,
  Eye,
  Trash2,
  Mail
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { AdminManagement } from './AdminManagement';
import { DatabaseExport } from './DatabaseExport';
import { ReaderManagement } from './ReaderManagement';
import { EmailConfig } from './EmailConfig';

interface UserData {
  id: string;
  status: string;
  email?: string;
  full_name?: string;
  office?: string;
  department?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

interface EditingUser extends UserData {
  isEditing: boolean;
}

interface UserStats {
  total_users: number;
  users_with_names: number;
  users_with_offices: number;
  completion_percentage: number;
}

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingUsers, setEditingUsers] = useState<{ [key: string]: EditingUser }>({});
  const [activeTab, setActiveTab] = useState<'list' | 'admins' | 'readers' | 'export' | 'config_email'>('list');
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);
  const { startTransition } = useViewTransition();
  const { navigateWithTransition } = useNavigationTransition();


  const queryClient = useQueryClient();

  // Query para obtener SOLO usuarios de impresiones (tabla users)
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['printing-users-only'],
    queryFn: async () => {
      console.log('🔍 Obteniendo SOLO usuarios de impresiones (tabla users)...');

      // Obtener usuarios desde el backend API
      const allUsers = await apiClient.getUsers();

      console.log(`👥 Total usuarios recuperados: ${allUsers?.length || 0}`);

      // Filtrar administradores y lectores - solo mostrar usuarios de impresiones (role 'user' o null/undefined)
      const filteredResult = (allUsers as UserData[])?.filter(u =>
        u.role !== 'admin' && u.role !== 'reader' && u.role !== 'superadmin'
      );

      console.log(`👥 Usuarios de impresiones filtrados: ${filteredResult?.length || 0}`);

      return filteredResult;
    },
  });

  // Query para estadísticas de usuarios de impresiones
  const { data: userStats } = useQuery({
    queryKey: ['printing-user-stats'],
    queryFn: async () => {
      if (!users) return null;

      const total = users.length;
      const withNames = users.filter(u => u.full_name && u.full_name.trim() !== '').length;
      const withOffices = users.filter(u => u.office && u.office.trim() !== '').length;
      const completion = total > 0 ? Math.round(((withNames + withOffices) / (total * 2)) * 100) : 0;

      return {
        total_users: total,
        users_with_names: withNames,
        users_with_offices: withOffices,
        completion_percentage: completion
      } as UserStats;
    },
    enabled: !!users
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-list-printing'],
    queryFn: async () => {
      if (!users) return [];
      const uniqueOffices = [...new Set(users.map(u => u.office).filter(Boolean))];
      return uniqueOffices.sort();
    },
    enabled: !!users
  });

  // Mutation para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<UserData> & { id: string }) => {
      // Usar apiClient para actualizar usuario
      await apiClient.updateUser(userData.id, {
        full_name: userData.full_name,
        email: userData.email,
        office: userData.office,
        department: userData.department,
        status: userData.status
      });
      return userData;
    },
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['printing-users-only'] });
        queryClient.invalidateQueries({ queryKey: ['printing-user-stats'] });
      });
    }
  });

  // Mutation para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Usar apiClient para eliminar usuario y todos sus datos relacionados
      await apiClient.deleteUser(userId);
      return { success: true, message: 'Usuario y sus datos eliminados correctamente' };
    },
    onSuccess: (result) => {
      setDeleteResult(result);
      // Actualizar queries
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['printing-users-only'] });
        queryClient.invalidateQueries({ queryKey: ['printing-user-stats'] });
      });

      // Cerrar modal y limpiar
      setTimeout(() => {
        setShowDeleteConfirm(false);
        setUserToDelete(null);
        setDeleteResult(null);
      }, 2000);
    },
    onError: (error) => {
      console.error('Error deleting user:', error);
      setDeleteResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Error eliminando usuario'}`
      });
    }
  });

  // Filtrar usuarios
  const filteredUsers = users?.filter(user => {
    const matchesSearch = !searchTerm ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOffice = !filterOffice || user.office === filterOffice;
    const matchesStatus = !filterStatus || user.status === filterStatus;

    return matchesSearch && matchesOffice && matchesStatus;
  }) || [];

  const startEditing = (user: UserData) => {
    startTransition(() => {
      setEditingUsers(prev => ({
        ...prev,
        [user.id]: { ...user, isEditing: true }
      }));
    });
  };

  const cancelEditing = (userId: string) => {
    startTransition(() => {
      setEditingUsers(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    });
  };

  const saveUser = async (userId: string) => {
    const editingUser = editingUsers[userId];
    if (!editingUser) return;

    try {
      await updateUserMutation.mutateAsync(editingUser);
      cancelEditing(userId);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const updateEditingUser = (userId: string, field: keyof UserData, value: string) => {
    startTransition(() => {
      setEditingUsers(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [field]: value
        }
      }));
    });
  };

  const handleDeleteClick = (user: UserData) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
    setDeleteResult(null);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    await deleteUserMutation.mutateAsync(userToDelete.id);
  };

  const handleTabChange = (tabId: string) => {
    navigateWithTransition(() => {
      setActiveTab(tabId as any);
    }, 'slide-left');
  };

  const getCompletionStatus = (user: UserData) => {
    const hasName = user.full_name && user.full_name.trim() !== '';
    const hasOffice = user.office && user.office.trim() !== '';

    if (hasName && hasOffice) return 'complete';
    if (hasName || hasOffice) return 'partial';
    return 'incomplete';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600 bg-green-100';
      case 'partial': return 'text-yellow-600 bg-yellow-100';
      case 'incomplete': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return CheckCircle;
      case 'partial': return AlertCircle;
      case 'incomplete': return X;
      default: return User;
    }
  };

  const { isSuperAdmin } = useAuth();

  const tabs = [
    { id: 'list', name: 'Usuarios de Impresiones', icon: Users },
    // Solo Super Admin puede ver/gestionar administradores
    ...(isSuperAdmin() ? [{ id: 'admins', name: 'Administradores', icon: Shield }] : []),
    { id: 'readers', name: 'Usuarios Lectores', icon: Eye },
    // Solo Super Admin puede exportar la base de datos
    ...(isSuperAdmin() ? [
      { id: 'export', name: 'Exportar BD', icon: Database },
      { id: 'config_email', name: 'Configuración Correo', icon: Mail }
    ] : [])
  ];

  if (usersLoading) {
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
    <div className="space-y-6 management-transition">
      {/* Header y Estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Gestión de Usuarios
            </h2>
            <p className="text-gray-600">
              Administrar usuarios de impresiones y gestionar administradores por separado
            </p>
          </div>
        </div>

        {/* Estadísticas */}
        {userStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 stats-transition">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Usuarios de Impresiones</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {userStats.total_users}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Con Nombres</p>
                  <p className="text-2xl font-bold text-green-900">
                    {userStats.users_with_names}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Con Oficinas</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {offices?.length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Completitud</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {userStats.completion_percentage}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Contenido de las tabs */}
      {/* Contenido de las tabs */}
      {activeTab === 'admins' ? (
        <AdminManagement />
      ) : activeTab === 'readers' ? (
        <ReaderManagement />
      ) : activeTab === 'export' ? (
        <DatabaseExport />
      ) : activeTab === 'config_email' ? (
        <EmailConfig />
      ) : (
        <>
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    placeholder="ID, nombre o email..."
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
                  {offices?.map(office => (
                    <option key={office} value={office}>{office}</option>
                  ))}
                  <option value="Sin oficina">Sin oficina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="Normal">Normal</option>
                  <option value="Inactive">Inactivo</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterOffice('');
                    setFilterStatus('');
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Información sobre usuarios de impresiones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Users className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Información sobre Usuarios de Impresiones
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• <strong>Los usuarios de impresiones se crean automáticamente</strong> durante la importación de archivos CSV</p>
                  <p>• <strong>Puedes editar la información</strong> de usuarios existentes (nombre, email, oficina, departamento)</p>
                  <p>• <strong>Los administradores están completamente separados</strong> y se gestionan en la pestaña "Administradores"</p>
                  <p>• <strong>Esta lista NO incluye administradores</strong> - solo usuarios del sistema de impresiones</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Lista de Usuarios de Impresiones ({filteredUsers.length})
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Solo usuarios del sistema de impresiones - administradores gestionados por separado
              </p>
            </div>

            <div className="overflow-x-auto table-transition">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre Completo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Oficina
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const isEditing = editingUsers[user.id]?.isEditing;
                    const editingUser = editingUsers[user.id] || user;
                    const completionStatus = getCompletionStatus(user);
                    const StatusIcon = getStatusIcon(completionStatus);

                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(completionStatus)}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {completionStatus === 'complete' ? 'Completo' :
                              completionStatus === 'partial' ? 'Parcial' : 'Incompleto'}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.id}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.status}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingUser.full_name || ''}
                              onChange={(e) => updateEditingUser(user.id, 'full_name', e.target.value)}
                              placeholder="Nombre completo"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">
                              {user.full_name || (
                                <span className="text-gray-400 italic">Sin nombre</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="email"
                              value={editingUser.email || ''}
                              onChange={(e) => updateEditingUser(user.id, 'email', e.target.value)}
                              placeholder="email@empresa.com"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">
                              {user.email || (
                                <span className="text-gray-400 italic">Sin email</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingUser.office || ''}
                              onChange={(e) => updateEditingUser(user.id, 'office', e.target.value)}
                              placeholder="Oficina"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">
                              {user.office || (
                                <span className="text-gray-400 italic">Sin oficina</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingUser.department || ''}
                              onChange={(e) => updateEditingUser(user.id, 'department', e.target.value)}
                              placeholder="Departamento"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">
                              {user.department || (
                                <span className="text-gray-400 italic">Sin departamento</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => saveUser(user.id)}
                                disabled={updateUserMutation.isPending}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => cancelEditing(user.id)}
                                disabled={updateUserMutation.isPending}
                                className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <button
                                onClick={() => startEditing(user)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(user)}
                                className="text-red-600 hover:text-red-900 ml-2"
                                title="Eliminar usuario y todos sus datos"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="p-6 text-center">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No se encontraron usuarios de impresiones
                </h3>
                <p className="text-gray-600">
                  {users?.length === 0
                    ? 'Los usuarios aparecerán aquí después de la primera importación de CSV.'
                    : 'Ajusta los filtros para ver más resultados.'
                  }
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 m-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center text-red-600">
                <div className="bg-red-100 p-2 rounded-full mr-3">
                  <Trash2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">Confirmar Eliminación</h3>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que deseas eliminar al usuario <strong>"{userToDelete.full_name || userToDelete.id}"</strong> (ID: {userToDelete.id})?
              </p>

              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
                <p className="font-bold flex items-center mb-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Advertencia: Esto eliminará:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>El usuario de la lista de impresiones</li>
                  <li>Todos sus datos de impresión históricos</li>
                  <li>Sus datos mensuales agregados</li>
                  <li>Sus asignaciones de impresoras</li>
                  <li>Los datos <strong>no se podrán recuperar</strong></li>
                </ul>
              </div>

              {deleteResult && (
                <div className={`mt-4 p-3 rounded-lg border ${deleteResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  <div className="flex items-center">
                    {deleteResult.success ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    {deleteResult.message}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={deleteUserMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}