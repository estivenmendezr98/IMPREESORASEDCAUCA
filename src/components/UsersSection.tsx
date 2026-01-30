import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewTransition } from '../hooks/useViewTransition';
import {
  User,
  Users,
  Search,
  Building,
  UserCheck,
  Activity,
  Calendar,
  TrendingUp,
  Filter,
  Download,
  Eye,
  Edit3,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Mail,
  Printer,
  Copy,
  Scan,
  Send,
  BarChart3
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface UserData {
  id: string;
  status: string;
  email?: string;
  full_name?: string;
  office?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

interface UserWithActivity extends UserData {
  total_prints: number;
  total_copies: number;
  total_scans: number;
  total_fax: number;
  last_activity: string | null;
  months_active: number;
}

interface UserStats {
  total_users: number;
  active_users: number;
  users_with_names: number;
  users_with_offices: number;
}

interface EditingUser extends UserWithActivity {
  isEditing: boolean;
}

export function UsersSection() {
  const { canModify } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingUsers, setEditingUsers] = useState<{ [key: string]: EditingUser }>({});
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithActivity | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const { startTransition } = useViewTransition();

  const queryClient = useQueryClient();

  // Query para obtener usuarios con actividad (SOLO usuarios de impresiones)
  const { data: usersWithActivity, isLoading: usersLoading } = useQuery({
    queryKey: ['users-with-activity'],
    queryFn: async () => {
      try {
        console.log('🔍 Obteniendo usuarios de impresiones con actividad...');

        // Obtener SOLO usuarios de la tabla users (usuarios de impresiones) via apiClient
        const users = await apiClient.getUsers();

        if (!users) {
          console.error('Error obteniendo usuarios');
          throw new Error('Error obteniendo usuarios');
        }

        console.log(`👥 Usuarios de impresiones encontrados: ${users.length || 0}`);

        // Obtener totales por usuario usando apiClient
        const userTotals = await apiClient.getUserTotals();

        console.log(`📊 Totales obtenidos para ${userTotals?.length || 0} usuarios`);

        // Combinar datos de usuarios con totales
        const usersWithTotals = users.map((user: any) => {
          const userTotal = userTotals?.find((ut: any) => ut.user_id === user.id);
          return {
            ...user,
            total_prints: userTotal?.total_prints || 0,
            total_copies: userTotal?.total_copies || 0,
            total_scans: userTotal?.total_scans || 0,
            total_fax: userTotal?.total_fax || 0,
            last_activity: userTotal?.last_activity || null,
            months_active: 0 // Calcular si es necesario
          };
        });

        console.log('✅ Datos combinados exitosamente (solo usuarios de impresiones)');
        // console.log('📈 Muestra de usuarios con actividad:', usersWithTotals.slice(0, 3));

        return usersWithTotals as UserWithActivity[];
      } catch (error) {
        console.error('💥 Error obteniendo usuarios con actividad:', error);
        throw error;
      }
    },
  });

  // Mutation para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<UserWithActivity> & { id: string }) => {
      try {
        await apiClient.updateUser(userData.id, {
          full_name: userData.full_name,
          email: userData.email,
          office: userData.office,
          department: userData.department,
          status: userData.status
        });
        return userData;
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-activity'] });
      queryClient.invalidateQueries({ queryKey: ['users-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });

  // Mutation para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Usar apiClient para eliminar usuario y todos sus datos relacionados
      // El backend se encarga de eliminar prints_raw, prints_monthly y user_printer_assignments
      await apiClient.deleteUser(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-activity'] });
      queryClient.invalidateQueries({ queryKey: ['users-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      setDeleteResult({
        success: true,
        message: '✅ Usuario eliminado exitosamente junto con todos sus datos'
      });

      // Limpiar resultado después de 5 segundos
      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
    },
    onError: (error) => {
      setDeleteResult({
        success: false,
        message: `❌ Error eliminando usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });

      // Limpiar resultado después de 5 segundos
      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
    }
  });

  // Query para estadísticas de usuarios (solo usuarios de impresiones)
  const { data: userStats } = useQuery({
    queryKey: ['users-stats'],
    queryFn: async () => {
      if (!usersWithActivity) return null;

      const total = usersWithActivity.length;
      const active = usersWithActivity.filter(u =>
        u.total_prints > 0 || u.total_copies > 0 || u.total_scans > 0 || u.total_fax > 0
      ).length;
      const withNames = usersWithActivity.filter(u => u.full_name && u.full_name.trim() !== '').length;
      const withOffices = usersWithActivity.filter(u => u.office && u.office.trim() !== '').length;

      return {
        total_users: total,
        active_users: active,
        users_with_names: withNames,
        users_with_offices: withOffices
      } as UserStats;
    },
    enabled: !!usersWithActivity
  });

  // Query para obtener oficinas únicas
  const { data: offices } = useQuery({
    queryKey: ['offices-list-users'],
    queryFn: async () => {
      if (!usersWithActivity) return [];
      const uniqueOffices = [...new Set(usersWithActivity.map(u => u.office).filter(Boolean))];
      return uniqueOffices.sort();
    },
    enabled: !!usersWithActivity
  });

  // Filtrar usuarios
  const filteredUsers = usersWithActivity?.filter(user => {
    const matchesSearch = !searchTerm ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.office && user.office.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOffice = !filterOffice ||
      (filterOffice === 'Sin oficina' ? !user.office : user.office === filterOffice);
    const matchesStatus = !filterStatus || user.status === filterStatus;

    return matchesSearch && matchesOffice && matchesStatus;
  }) || [];

  // Funciones de edición
  const startEditing = (user: UserWithActivity) => {
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

  const updateEditingUser = (userId: string, field: keyof UserWithActivity, value: string) => {
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

  // Funciones de eliminación
  const handleDeleteUser = (userId: string, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setShowDeleteConfirm(true);
    setDeleteResult(null);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    await deleteUserMutation.mutateAsync(userToDelete.id);
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
    setDeleteResult(null);
  };

  // Función para ver detalles del usuario
  const handleViewUser = (user: UserWithActivity) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const closeUserDetails = () => {
    setShowUserDetails(false);
    setSelectedUser(null);
  };

  // Función para obtener detalles mensuales del usuario
  const { data: userMonthlyDetails, isLoading: monthlyLoading, isError, error } = useQuery({
    queryKey: ['user-monthly-details', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return [];

      try {
        // Usamos fetch directo temporalmente para evitar problemas de caché con apiClient
        const response = await fetch(`/api/users/${selectedUser.id}/monthly-all`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        return data.map((row: any) => ({
          ...row,
          month_name: new Intl.DateTimeFormat('es-ES', {
            month: 'long',
            year: 'numeric'
          }).format(new Date(row.year, row.month - 1))
        }));
      } catch (err) {
        console.error('Error fetching monthly details:', err);
        throw err;
      }
    },
    enabled: !!selectedUser && showUserDetails,
    retry: 1
  });

  const exportToCSV = () => {
    if (!filteredUsers.length) return;

    startTransition(() => {
      const headers = [
        'ID Usuario',
        'Nombre Completo',
        'Email',
        'Oficina',
        'Departamento',
        'Estado',
        'Total Impresiones',
        'Total Copias',
        'Total Escaneos',
        'Total Fax',
        'Última Actividad',
        'Meses Activo'
      ];

      const csvContent = [
        headers.join(','),
        ...filteredUsers.map(user => [
          user.id,
          `"${user.full_name || ''}"`,
          `"${user.email || ''}"`,
          `"${user.office || ''}"`,
          `"${user.department || ''}"`,
          user.status,
          user.total_prints,
          user.total_copies,
          user.total_scans,
          user.total_fax,
          user.last_activity ? new Date(user.last_activity).toLocaleDateString() : '',
          user.months_active
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `usuarios_impresiones_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

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
    <div className="space-y-6 users-transition">
      {/* Resultado de eliminación */}
      {deleteResult && (
        <div className={`p-4 rounded-lg border ${deleteResult.success
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-start">
            {deleteResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            )}
            <p className={`text-sm ${deleteResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
              {deleteResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Header y Estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Usuarios de Impresiones
            </h2>
            <p className="text-gray-600">
              Usuarios del sistema de impresiones con estadísticas de actividad (separados de administradores)
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
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
                    {userStats.total_users.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Usuarios Activos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {userStats.active_users.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Con Nombres</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {userStats.users_with_names.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Con Oficinas</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {userStats.users_with_offices.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Información sobre separación de usuarios */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <Users className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Información sobre Usuarios de Impresiones
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Esta lista muestra SOLO usuarios de impresiones</strong> del sistema</p>
                <p>• <strong>Los administradores están completamente separados</strong> y NO aparecen aquí</p>
                <p>• <strong>Los usuarios aparecen automáticamente</strong> cuando se importan datos CSV</p>
                {canModify() && <p>• <strong>Puedes editar o eliminar usuarios</strong> directamente desde esta lista</p>}
                <p>• <strong>Los administradores se gestionan</strong> en "Gestión" → "Administradores"</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros Mejorados */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
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
                placeholder="ID, nombre, email u oficina..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Oficina
            </label>
            <div className="relative">
              <Building className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">Todas las oficinas</option>
                {offices?.map(office => (
                  <option key={office} value={office}>{office}</option>
                ))}
                <option value="Sin oficina">Sin oficina</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <div className="relative">
              <Filter className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">Todos los estados</option>
                <option value="Normal">Normal</option>
                <option value="Inactive">Inactivo</option>
              </select>
            </div>
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

        {/* Información de filtros activos */}
        {(searchTerm || filterOffice || filterStatus) && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Filter className="h-4 w-4 text-blue-600 mr-2" />
              <div className="text-sm text-blue-700">
                <span className="font-medium">Filtros activos:</span>
                {searchTerm && <span className="ml-2">Búsqueda: "{searchTerm}"</span>}
                {filterOffice && <span className="ml-2">Oficina: "{filterOffice}"</span>}
                {filterStatus && <span className="ml-2">Estado: "{filterStatus}"</span>}
                <span className="ml-2 font-medium">
                  ({filteredUsers.length} de {usersWithActivity?.length || 0} usuarios)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Usuarios de Impresiones ({filteredUsers.length})
            </h3>
            <div className="text-sm text-gray-500">
              Mostrando {filteredUsers.length} de {usersWithActivity?.length || 0} usuarios de impresiones
            </div>
          </div>
        </div>

        <div className="table-transition">
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
                    Email
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
                      <Send className="h-4 w-4 mr-1" />
                      Fax
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
                      <Activity className="h-4 w-4 mr-1" />
                      Última Actividad
                    </div>
                  </th>
                  {canModify() && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  )}
                  {!canModify() && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ver
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const isEditing = editingUsers[user.id]?.isEditing;
                  const editingUser = editingUsers[user.id] || user;
                  const totalOperations = user.total_prints + user.total_copies + user.total_scans + user.total_fax;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editingUser.full_name || ''}
                                  onChange={(e) => updateEditingUser(user.id, 'full_name', e.target.value)}
                                  placeholder="Nombre completo"
                                  className="text-sm font-medium border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="text-sm text-gray-500">
                                  ID: {user.id}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {user.full_name || 'Sin nombre'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {user.id}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editingUser.office || ''}
                              onChange={(e) => updateEditingUser(user.id, 'office', e.target.value)}
                              placeholder="Oficina"
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              value={editingUser.department || ''}
                              onChange={(e) => updateEditingUser(user.id, 'department', e.target.value)}
                              placeholder="Departamento"
                              className="text-xs border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Building className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">
                                {user.office || (
                                  <span className="text-gray-400 italic">Sin oficina asignada</span>
                                )}
                              </div>
                              {user.department && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {user.department}
                                </div>
                              )}
                            </div>
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
                            className="text-sm border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">
                            {user.email || (
                              <span className="text-gray-400 italic">Sin email</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {user.total_prints.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {user.total_copies.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600">
                        {user.total_scans.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {user.total_fax.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {totalOperations.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {user.last_activity
                            ? new Intl.DateTimeFormat('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(user.last_activity))
                            : 'Sin actividad'
                          }
                        </div>
                      </td>

                      {canModify() && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => saveUser(user.id)}
                                disabled={updateUserMutation.isPending}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 p-1 rounded hover:bg-green-50"
                                title="Guardar cambios"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => cancelEditing(user.id)}
                                disabled={updateUserMutation.isPending}
                                className="text-gray-600 hover:text-gray-900 disabled:opacity-50 p-1 rounded hover:bg-gray-50"
                                title="Cancelar edición"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleViewUser(user)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                                title="Ver detalles del usuario"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditing(user)}
                                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                                title="Editar usuario"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.full_name || user.id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                      {!canModify() && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Ver detalles del usuario"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length === 0 && !usersLoading && (
          <div className="p-6 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {usersWithActivity?.length === 0
                ? 'No hay usuarios de impresiones registrados'
                : 'No se encontraron usuarios de impresiones'
              }
            </h3>
            <p className="text-gray-600">
              {usersWithActivity?.length === 0
                ? 'Los usuarios aparecerán aquí después de la primera importación de datos CSV.'
                : 'Ajusta los filtros para ver más resultados.'
              }
            </p>
            {(searchTerm || filterOffice || filterStatus) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterOffice('');
                  setFilterStatus('');
                }}
                className="mt-3 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
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
                  ¿Estás seguro de que deseas eliminar al usuario{' '}
                  <strong>"{userToDelete.name}"</strong> (ID: {userToDelete.id})?
                </p>
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    <strong>⚠️ Advertencia:</strong> Esto eliminará:
                  </p>
                  <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                    <li>El usuario de la lista de impresiones</li>
                    <li>Todos sus datos de impresión históricos</li>
                    <li>Sus datos mensuales agregados</li>
                    <li>Sus asignaciones de impresoras</li>
                    <li>Los datos no se podrán recuperar</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDeleteUser}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteUserMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Eliminando...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Usuario
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles del Usuario */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Detalles del Usuario
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedUser.full_name || 'Sin nombre'} (ID: {selectedUser.id})
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeUserDetails}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Información General */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">
                    Información Personal
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Nombre Completo</p>
                        <p className="text-sm text-gray-900">{selectedUser.full_name || 'Sin nombre'}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Email</p>
                        <p className="text-sm text-gray-900">{selectedUser.email || 'Sin email'}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Building className="h-4 w-4 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Oficina</p>
                        <p className="text-sm text-gray-900">{selectedUser.office || 'Sin oficina'}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Building className="h-4 w-4 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Departamento</p>
                        <p className="text-sm text-gray-900">{selectedUser.department || 'Sin departamento'}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Estado</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedUser.status === 'Normal'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {selectedUser.status === 'Normal' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">
                    Estadísticas de Actividad
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center">
                        <Printer className="h-5 w-5 text-blue-600 mr-2" />
                        <div>
                          <p className="text-xs font-medium text-blue-600">Impresiones</p>
                          <p className="text-lg font-bold text-blue-900">
                            {selectedUser.total_prints.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <Copy className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="text-xs font-medium text-green-600">Copias</p>
                          <p className="text-lg font-bold text-green-900">
                            {selectedUser.total_copies.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="flex items-center">
                        <Scan className="h-5 w-5 text-yellow-600 mr-2" />
                        <div>
                          <p className="text-xs font-medium text-yellow-600">Escaneos</p>
                          <p className="text-lg font-bold text-yellow-900">
                            {selectedUser.total_scans.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="flex items-center">
                        <Send className="h-5 w-5 text-red-600 mr-2" />
                        <div>
                          <p className="text-xs font-medium text-red-600">Fax</p>
                          <p className="text-lg font-bold text-red-900">
                            {selectedUser.total_fax.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Total de Operaciones</span>
                      <span className="text-xl font-bold text-gray-900">
                        {(selectedUser.total_prints + selectedUser.total_copies + selectedUser.total_scans + selectedUser.total_fax).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {selectedUser.last_activity && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                        <div>
                          <p className="text-xs font-medium text-blue-600">Última Actividad</p>
                          <p className="text-sm text-blue-900">
                            {new Intl.DateTimeFormat('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }).format(new Date(selectedUser.last_activity))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial Mensual */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">
                  Historial Mensual de Actividad
                </h4>

                {monthlyLoading ? (
                  <div className="animate-pulse space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : isError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-red-800 mb-2">Error cargando historial</h3>
                    <p className="text-red-600 mb-4">{error instanceof Error ? error.message : 'Error desconocido'}</p>
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['user-monthly-details', selectedUser?.id] })}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : userMonthlyDetails && userMonthlyDetails.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mes/Año
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Impresiones
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Copias
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Escaneos
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fax
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Diferencia
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {userMonthlyDetails.map((month: any) => {
                          const monthTotal = (month.print_total || 0) + (month.copy_total || 0) + (month.scan_total || 0) + (month.fax_total || 0);
                          const monthDiff = (month.print_total_diff || 0) + (month.copy_total_diff || 0) + (month.scan_total_diff || 0) + (month.fax_total_diff || 0);

                          return (
                            <tr key={`${month.year}-${month.month}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {month.month_name}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">
                                {(month.print_total || 0).toLocaleString()}
                                {month.print_total_diff > 0 && (
                                  <div className="text-xs text-blue-500">
                                    +{month.print_total_diff.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                                {(month.copy_total || 0).toLocaleString()}
                                {month.copy_total_diff > 0 && (
                                  <div className="text-xs text-green-500">
                                    +{month.copy_total_diff.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                {(month.scan_total || 0).toLocaleString()}
                                {month.scan_total_diff > 0 && (
                                  <div className="text-xs text-yellow-500">
                                    +{month.scan_total_diff.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium">
                                {(month.fax_total || 0).toLocaleString()}
                                {month.fax_total_diff > 0 && (
                                  <div className="text-xs text-red-500">
                                    +{month.fax_total_diff.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                                {monthTotal.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {monthDiff > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    +{monthDiff.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-500">Sin cambios</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Sin historial mensual
                    </h3>
                    <p className="text-gray-600">
                      No se encontraron datos mensuales para este usuario.
                    </p>
                  </div>
                )}
              </div>

              {/* Botones de acción en el modal */}
              {canModify() && (
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      closeUserDetails();
                      startEditing(selectedUser);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar Usuario
                  </button>
                  <button
                    onClick={() => {
                      closeUserDetails();
                      handleDeleteUser(selectedUser.id, selectedUser.full_name || selectedUser.id);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Usuario
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información sobre edición y eliminación */}
      {canModify() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ Gestión de Usuarios de Impresiones
              </h4>
              <div className="text-sm text-yellow-700 space-y-1">
                <p>• <strong>Ver:</strong> Consulta información detallada y historial mensual del usuario</p>
                <p>• <strong>Editar:</strong> Puedes modificar nombre, email, oficina y departamento</p>
                <p>• <strong>Eliminar:</strong> Elimina completamente el usuario y TODOS sus datos históricos</p>
                <p>• <strong>Uso típico:</strong> Corregir usuarios creados con IDs incorrectos en CSV</p>
                <p>• <strong>Datos eliminados:</strong> Impresiones, copias, escaneos, fax, asignaciones de impresoras</p>
                <p>• <strong>⚠️ Importante:</strong> La eliminación es permanente y no se puede deshacer</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}