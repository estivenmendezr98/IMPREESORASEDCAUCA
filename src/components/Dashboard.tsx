import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useViewTransition } from '../hooks/useViewTransition';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  Printer,
  Copy,
  Building,
  Activity,
  Settings,
  X,
  GripVertical,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Award,
  Crown,
  Medal
} from 'lucide-react';
import apiClient from '../lib/api';
import { StatsCard } from './StatsCard';
import { UsersTable } from './UsersTable';
import {
  format,
  subMonths,
  startOfMonth,
  addMonths
} from 'date-fns';
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';





interface ChartControls {
  period: 'last3months' | 'last6months' | 'last12months' | 'currentyear' | 'all';
  dataType: 'all' | 'prints' | 'copies' | 'scans' | 'fax' | 'prints_copies';
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'pictogram' | 'composed';
  groupBy: 'month' | 'office' | 'user' | 'quarter';
  topN: 5 | 10 | 15 | 20;
  showTrendLine: boolean;
}

interface Widget {
  id: string;
  title: string;
  type: 'chart' | 'stat' | 'table';
  chartType?: string;
  position: number;
  size: 'small' | 'medium' | 'large' | 'full';
  enabled: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'];

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'monthly-trend', title: 'Tendencia Mensual', type: 'chart', chartType: 'line', position: 0, size: 'large', enabled: true },
  { id: 'distribution', title: 'Distribución de Operaciones', type: 'chart', chartType: 'pie', position: 1, size: 'medium', enabled: true },
  { id: 'office-ranking', title: 'Ranking de Oficinas', type: 'chart', chartType: 'bar', position: 2, size: 'large', enabled: true },
  { id: 'top-users', title: 'Top Usuarios', type: 'chart', chartType: 'pictogram', position: 3, size: 'medium', enabled: true },
  { id: 'stats-cards', title: 'Estadísticas Principales', type: 'stat', position: 4, size: 'full', enabled: true },
  { id: 'peak-months', title: 'Meses Pico', type: 'chart', chartType: 'pictogram', position: 5, size: 'medium', enabled: true },
  { id: 'combined-trend', title: 'Tendencias Combinadas', type: 'chart', chartType: 'composed', position: 6, size: 'large', enabled: true },
  { id: 'users-table', title: 'Tabla de Usuarios', type: 'table', position: 7, size: 'full', enabled: true }
];

export function Dashboard() {
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [chartControls, setChartControls] = useState<ChartControls>({
    period: 'last6months',
    dataType: 'all',
    chartType: 'bar',
    groupBy: 'month',
    topN: 10,
    showTrendLine: true
  });
  const [showControls, setShowControls] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const { startTransition } = useViewTransition();

  // Cargar configuración guardada
  useEffect(() => {
    const savedWidgets = localStorage.getItem('dashboard-widgets');
    const savedControls = localStorage.getItem('dashboard-controls');

    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (error) {
        console.warn('Error loading saved widgets:', error);
      }
    }

    if (savedControls) {
      try {
        setChartControls(JSON.parse(savedControls));
      } catch (error) {
        console.warn('Error loading saved controls:', error);
      }
    }
  }, []);

  // Guardar configuración cuando cambian widgets o controles
  useEffect(() => {
    localStorage.setItem('dashboard-widgets', JSON.stringify(widgets));
    localStorage.setItem('dashboard-controls', JSON.stringify(chartControls));
  }, [widgets, chartControls]);


  // Query principal unificada para todos los datos del dashboard
  const { data: dashboardData, isLoading: dataLoading } = useQuery({
    queryKey: ['dashboard-unified-data', chartControls.period],
    queryFn: async () => {
      console.log('🔍 Obteniendo y procesando datos unificados...');

      // Obtener ultima importación para referencia
      const imports = await apiClient.getImportLog(undefined, undefined);

      // 1. Calcular rango de fechas
      const now = new Date();
      let startDate: Date;

      switch (chartControls.period) {
        case 'last3months': startDate = subMonths(now, 3); break;
        case 'last6months': startDate = subMonths(now, 6); break;
        case 'last12months': startDate = subMonths(now, 12); break;
        case 'currentyear': startDate = new Date(now.getFullYear(), 0, 1); break;
        case 'all': startDate = subMonths(now, 60); break; // 5 años atrás
        default: startDate = subMonths(now, 6);
      }

      // 2. Obtener TODOS los datos y usuarios
      const [allPrints, users] = await Promise.all([
        apiClient.getMonthlyPrints({}),
        apiClient.getUsers()
      ]);

      // 3. Filtrar por fecha (Normalizar a inicio de mes para comparación consistente)
      const normalizedStartDate = startOfMonth(startDate);
      const filteredPrints = allPrints.filter((row: any) => {
        const rowDate = new Date(row.year, row.month - 1);
        return rowDate >= normalizedStartDate;
      });

      console.log(`📊 Registros filtrados: ${filteredPrints.length} `);

      // 4. Calcular Estadísticas Agregadas (Cards)
      const summary = filteredPrints.reduce((acc: any, row: any) => ({
        prints: acc.prints + (Number(row.print_total) || 0),
        copies: acc.copies + (Number(row.copy_total) || 0),
        scans: acc.scans + (Number(row.scan_total) || 0),
        fax: acc.fax + (Number(row.fax_total) || 0),
        active_users: acc.active_users.add(row.user_id)
      }), { prints: 0, copies: 0, scans: 0, fax: 0, active_users: new Set() });

      // 5. Agrupar por Mes (Gráfico de Tendencias) y Rellenar Huecos
      const monthlyGroups: Record<string, any> = {};

      // Generar todos los meses en el rango
      let currentIterDate = startOfMonth(normalizedStartDate);
      const endIterDate = startOfMonth(now);

      while (currentIterDate <= endIterDate) {
        const y = currentIterDate.getFullYear();
        const m = currentIterDate.getMonth() + 1;
        const key = `${y}-${m.toString().padStart(2, '0')}`;

        monthlyGroups[key] = {
          month: format(currentIterDate, 'MMM yyyy', { locale: es }),
          year: y,
          monthNum: m,
          prints: 0,
          copies: 0,
          scans: 0,
          fax: 0,
          total: 0,
          active_users: new Set()
        };

        currentIterDate = addMonths(currentIterDate, 1);
      }

      // Llenar con datos existentes
      filteredPrints.forEach((row: any) => {
        const key = `${row.year}-${row.month.toString().padStart(2, '0')}`;
        // Si el registro está dentro del rango pero no se generó (raro si el while está bien), lo ignoramos
        if (monthlyGroups[key]) {
          const p = Number(row.print_total) || 0;
          const c = Number(row.copy_total) || 0;
          const s = Number(row.scan_total) || 0;
          const f = Number(row.fax_total) || 0;

          monthlyGroups[key].prints += p;
          monthlyGroups[key].copies += c;
          monthlyGroups[key].scans += s;
          monthlyGroups[key].fax += f;
          monthlyGroups[key].total += p + c + s + f;
          monthlyGroups[key].active_users.add(row.user_id);
        }
      });

      const trends = Object.values(monthlyGroups)
        .sort((a: any, b: any) => (a.year !== b.year ? a.year - b.year : a.monthNum - b.monthNum))
        .map((g: any) => ({ ...g, active_users: g.active_users.size }));

      // 6. Agrupar por Usuario (Top Users)
      const userGroups = filteredPrints.reduce((acc: any, row: any) => {
        if (!acc[row.user_id]) {
          const user = users.find((u: any) => u.id === row.user_id);
          acc[row.user_id] = {
            user_id: row.user_id,
            name: user?.full_name || row.user_id,
            office: user?.office || 'Sin oficina',
            total_prints: 0, total_copies: 0, total_scans: 0, total_fax: 0, total_operations: 0
          };
        }
        const p = Number(row.print_total) || 0;
        const c = Number(row.copy_total) || 0;
        const s = Number(row.scan_total) || 0;
        const f = Number(row.fax_total) || 0;

        acc[row.user_id].total_prints += p;
        acc[row.user_id].total_copies += c;
        acc[row.user_id].total_scans += s;
        acc[row.user_id].total_fax += f;
        acc[row.user_id].total_operations += p + c + s + f;
        return acc;
      }, {});

      const topUsers = Object.values(userGroups)
        .sort((a: any, b: any) => b.total_operations - a.total_operations);

      // Calcular porcentajes
      if (topUsers.length > 0) {
        const maxOps = Math.max(...topUsers.map((u: any) => u.total_operations));
        topUsers.forEach((u: any) => {
          u.percentage = maxOps > 0 ? Math.round((u.total_operations / maxOps) * 100) : 0;
          u.rank = 0; // Se asignará al renderizar o cortar
        });
      }

      // 7. Agrupar por Oficina (Ranking Oficinas)
      const officeGroups = Object.values(userGroups).reduce((acc: any, user: any) => {
        const office = user.office || 'Sin oficina';
        if (!acc[office]) {
          acc[office] = {
            office,
            user_count: 0,
            total_prints: 0, total_copies: 0, total_scans: 0, total_fax: 0, total_operations: 0
          };
        }
        acc[office].user_count++;
        acc[office].total_prints += user.total_prints;
        acc[office].total_copies += user.total_copies;
        acc[office].total_scans += user.total_scans;
        acc[office].total_fax += user.total_fax;
        acc[office].total_operations += user.total_operations;
        return acc;
      }, {});

      const officeRanking = Object.values(officeGroups as any)
        .sort((a: any, b: any) => b.total_operations - a.total_operations);

      return {
        summary: {
          ...summary,
          active_users: summary.active_users.size,
          total_users: users.length,
          last_import: imports.length > 0 ? imports[0].imported_at : undefined
        },
        trends,
        topUsers: topUsers.map((u: any) => ({
          ...u,
          // Aseguramos que last_activity sea string o null para UsersTable
          last_activity: null
        })),
        officeRanking
      };
    }
  });

  // Datos para distribución (gráfico circular)
  const distributionData = dashboardData?.summary ? [
    { name: 'Impresiones', value: dashboardData.summary.prints, color: COLORS[0] },
    { name: 'Copias', value: dashboardData.summary.copies, color: COLORS[1] },
    { name: 'Escaneos', value: dashboardData.summary.scans, color: COLORS[2] },
    { name: 'Fax', value: dashboardData.summary.fax, color: COLORS[3] }
  ].filter(item => item.value > 0) : [];

  // Top usuarios reales (ya calculado en query)
  const topUsersList = dashboardData?.topUsers?.slice(0, chartControls.topN).map((u: any, i: number) => ({ ...u, rank: i + 1 })) || [];

  // Meses pico reales
  const peakMonths = (dashboardData?.trends?.slice() || [])
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 6)
    .map((month: any, index: number) => ({
      rank: index + 1,
      month: month.month,
      total: month.total,
      prints: month.prints,
      copies: month.copies,
      scans: month.scans,
      fax: month.fax,
      active_users: month.active_users,
      percentage: Math.round((month.total / (Math.max(...(dashboardData?.trends?.map((t: any) => t.total) || [1])))) * 100)
    })) || [];

  // Funciones de renderizado de gráficas
  const renderChart = (widget: Widget) => {
    // const { chartType } = widget; // Removed unused variable

    switch (widget.id) {
      case 'monthly-trend':
        return renderMonthlyTrend();
      case 'distribution':
        return renderDistribution();
      case 'office-ranking':
        return renderOfficeRanking();
      case 'top-users':
        return renderTopUsers();
      case 'peak-months':
        return renderPeakMonths();
      case 'combined-trend':
        return renderCombinedTrend();
      default:
        return renderDefaultChart(widget);
    }
  };

  const renderMonthlyTrend = () => {
    if (dataLoading) {
      return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    if (!dashboardData?.trends || dashboardData.trends.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos mensuales disponibles</p>
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dashboardData.trends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis />
          <Tooltip
            formatter={(value: any) => [value.toLocaleString(), '']}
            labelFormatter={(label) => `Mes: ${label} `}
          />
          <Legend />
          {chartControls.dataType === 'all' || chartControls.dataType === 'prints' ? (
            <Line type="monotone" dataKey="prints" stroke={COLORS[0]} name="Impresiones" strokeWidth={2} />
          ) : null}
          {chartControls.dataType === 'all' || chartControls.dataType === 'copies' ? (
            <Line type="monotone" dataKey="copies" stroke={COLORS[1]} name="Copias" strokeWidth={2} />
          ) : null}
          {chartControls.dataType === 'all' || chartControls.dataType === 'scans' ? (
            <Line type="monotone" dataKey="scans" stroke={COLORS[2]} name="Escaneos" strokeWidth={2} />
          ) : null}
          {chartControls.dataType === 'all' || chartControls.dataType === 'fax' ? (
            <Line type="monotone" dataKey="fax" stroke={COLORS[3]} name="Fax" strokeWidth={2} />
          ) : null}
          {chartControls.showTrendLine && (
            <Line type="monotone" dataKey="total" stroke="#000000" name="Total" strokeWidth={3} strokeDasharray="5 5" />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderDistribution = () => {
    if (dataLoading || distributionData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos de distribución</p>
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={distributionData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}% `}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {distributionData.map((entry, index) => (
              <Cell key={`cell - ${index} `} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => value.toLocaleString()} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderOfficeRanking = () => {
    if (dataLoading) {
      return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    if (!dashboardData?.officeRanking || dashboardData.officeRanking.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Building className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos de oficinas disponibles</p>
          </div>
        </div>
      );
    }

    const topOffices = dashboardData.officeRanking.slice(0, chartControls.topN);

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={topOffices}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="office"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis />
          <Tooltip
            formatter={(value: any) => [value.toLocaleString(), '']}
            labelFormatter={(label) => `Oficina: ${label} `}
          />
          <Legend />
          <Bar dataKey="total_prints" fill={COLORS[0]} name="Impresiones" />
          <Bar dataKey="total_copies" fill={COLORS[1]} name="Copias" />
          <Bar dataKey="total_scans" fill={COLORS[2]} name="Escaneos" />
          <Bar dataKey="total_fax" fill={COLORS[3]} name="Fax" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTopUsers = () => {
    if (dataLoading) {
      return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    if (topUsersList.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos de usuarios disponibles</p>
          </div>
        </div>
      );
    }

    const getRankIcon = (rank: number) => {
      switch (rank) {
        case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
        case 2: return <Medal className="h-5 w-5 text-gray-400" />;
        case 3: return <Award className="h-5 w-5 text-amber-600" />;
        default: return <span className="text-sm font-bold text-gray-600">#{rank}</span>;
      }
    };

    return (
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {topUsersList.slice(0, 8).map((user: any) => (
          <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8">
                {getRankIcon(user.rank)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {user.name}
                </div>
                <div className="text-xs text-gray-500">
                  {user.office} • {user.total_operations.toLocaleString()} operaciones
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${user.percentage}% ` }}
                ></div>
              </div>
              <span className="text-xs text-gray-600 w-8 text-right">
                {user.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPeakMonths = () => {
    if (dataLoading) {
      return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    if (peakMonths.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos de meses disponibles</p>
          </div>
        </div>
      );
    }

    const getRankIcon = (rank: number) => {
      switch (rank) {
        case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
        case 2: return <Medal className="h-5 w-5 text-gray-400" />;
        case 3: return <Award className="h-5 w-5 text-amber-600" />;
        default: return <span className="text-sm font-bold text-gray-600">#{rank}</span>;
      }
    };

    return (
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {peakMonths.map((month) => (
          <div key={month.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8">
                {getRankIcon(month.rank)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {month.month}
                </div>
                <div className="text-xs text-gray-500">
                  {month.total.toLocaleString()} operaciones • {month.active_users} usuarios
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${month.percentage}% ` }}
                ></div>
              </div>
              <span className="text-xs text-gray-600 w-8 text-right">
                {month.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCombinedTrend = () => {
    if (dataLoading) {
      return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    if (!dashboardData?.trends || dashboardData.trends.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No hay datos de tendencias disponibles</p>
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dashboardData.trends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip
            formatter={(value: any) => [value.toLocaleString(), '']}
            labelFormatter={(label) => `Mes: ${label} `}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="prints" fill={COLORS[0]} name="Impresiones" />
          <Bar yAxisId="left" dataKey="copies" fill={COLORS[1]} name="Copias" />
          <Line yAxisId="right" type="monotone" dataKey="total" stroke="#000000" strokeWidth={3} name="Total" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderDefaultChart = (widget: Widget) => {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Settings className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Gráfica en desarrollo</p>
          <p className="text-xs text-gray-400">{widget.title}</p>
        </div>
      </div>
    );
  };

  const renderStatsCards = () => {
    if (dataLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-24 rounded-lg"></div>
          ))}
        </div>
      );
    }

    const stats = dashboardData?.summary || {
      prints: 0, copies: 0, scans: 0, active_users: 0, total_users: 0
    };

    const getPeriodLabel = (period: string) => {
      switch (period) {
        case 'last3months': return 'Últimos 3 meses';
        case 'last6months': return 'Últimos 6 meses';
        case 'last12months': return 'Últimos 12 meses';
        case 'currentyear': return 'Este año';
        case 'all': return 'Todos los datos';
        default: return 'Periodo actual';
      }
    };

    const periodLabel = getPeriodLabel(chartControls.period);

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          title="Total Usuarios"
          value={stats.total_users.toLocaleString()}
          icon={Users}
          color="blue"
          subtitle="Registrados"
        />
        <StatsCard
          title="Usuarios Activos"
          value={stats.active_users.toLocaleString()}
          icon={Activity}
          color="green"
          subtitle={periodLabel}
        />
        <StatsCard
          title="Impresiones"
          value={stats.prints.toLocaleString()}
          icon={Printer}
          color="purple"
          subtitle={periodLabel}
        />
        <StatsCard
          title="Copias"
          value={stats.copies.toLocaleString()}
          icon={Copy}
          color="orange"
          subtitle={periodLabel}
        />
      </div>
    );
  };

  const renderUsersTable = () => {
    if (dataLoading) {
      return <UsersTable users={[]} loading={true} />;
    }

    if (!dashboardData?.topUsers) {
      return (
        <div className="p-6 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay datos de usuarios
          </h3>
          <p className="text-gray-600">
            Los datos aparecerán después de la primera importación de CSV.
          </p>
        </div>
      );
    }

    return <UsersTable users={dashboardData.topUsers.slice(0, 20)} loading={false} />;
  };

  const toggleWidget = (widgetId: string) => {
    startTransition(() => {
      setWidgets(prev => prev.map(w =>
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w
      ));
    });
  };

  const updateChartControls = (updates: Partial<ChartControls>) => {
    startTransition(() => {
      setChartControls(prev => ({ ...prev, ...updates }));
    });
  };

  const resetToDefault = () => {
    startTransition(() => {
      setWidgets(DEFAULT_WIDGETS);
      setChartControls({
        period: 'last6months',
        dataType: 'all',
        chartType: 'bar',
        groupBy: 'month',
        topN: 10,
        showTrendLine: true
      });
      localStorage.removeItem('dashboard-widgets');
      localStorage.removeItem('dashboard-controls');
    });
  };

  const exportDashboardData = () => {
    if (!dashboardData) return;

    const exportData = {
      summary: dashboardData.summary,
      trends: dashboardData.trends,
      top_users: dashboardData.topUsers.slice(0, 20),
      office_ranking: dashboardData.officeRanking,
      export_date: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard_data_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Ordenar widgets por posición y filtrar habilitados
  const enabledWidgets = widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6 dashboard-transition">
      {/* Header con controles */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Dashboard Personalizable
            </h2>
            <p className="text-gray-600">
              Análisis interactivo con gráficas personalizables y datos en tiempo real
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowControls(!showControls)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showControls ? 'Ocultar' : 'Mostrar'} Controles
            </button>

            <button
              onClick={() => setShowCustomization(!showCustomization)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              Personalizar
            </button>

            <button
              onClick={exportDashboardData}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Controles de gráficas */}
        {showControls && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <select
                value={chartControls.period}
                onChange={(e) => updateChartControls({ period: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="last3months">Últimos 3 meses</option>
                <option value="last6months">Últimos 6 meses</option>
                <option value="last12months">Últimos 12 meses</option>
                <option value="currentyear">Año actual</option>
                <option value="all">Todos los datos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Datos
              </label>
              <select
                value={chartControls.dataType}
                onChange={(e) => updateChartControls({ dataType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="prints">Solo Impresiones</option>
                <option value="copies">Solo Copias</option>
                <option value="scans">Solo Escaneos</option>
                <option value="fax">Solo Fax</option>
                <option value="prints_copies">Impresiones + Copias</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agrupar Por
              </label>
              <select
                value={chartControls.groupBy}
                onChange={(e) => updateChartControls({ groupBy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Mes</option>
                <option value="office">Oficina</option>
                <option value="user">Usuario</option>
                <option value="quarter">Trimestre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Top N
              </label>
              <select
                value={chartControls.topN}
                onChange={(e) => updateChartControls({ topN: parseInt(e.target.value) as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
                <option value={20}>Top 20</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={chartControls.showTrendLine}
                  onChange={(e) => updateChartControls({ showTrendLine: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Línea de tendencia</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetToDefault}
                className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
              >
                Restablecer
              </button>
            </div>
          </div>
        )}

        {/* Panel de personalización */}
        {showCustomization && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Personalizar Widgets
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {widgets.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => toggleWidget(widget.id)}
                  className={`
                    flex items - center justify - between p - 3 rounded - lg border text - sm transition - colors
                    ${widget.enabled
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }
`}
                >
                  <span className="font-medium">{widget.title}</span>
                  {widget.enabled ? (
                    <Eye className="h-4 w-4 text-blue-600" />
                  ) : (
                    <X className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid de widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {enabledWidgets.map((widget) => (
          <div
            key={widget.id}
            className={`
bg - white rounded - lg shadow - sm border p - 6 chart - transition
              ${widget.size === 'full' ? 'lg:col-span-2' : ''}
              ${widget.size === 'large' ? 'lg:col-span-2' : ''}
`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {widget.title}
              </h3>
              <div className="flex items-center space-x-2">
                <GripVertical className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="widget-content">
              {widget.type === 'stat' ? renderStatsCards() :
                widget.type === 'table' ? renderUsersTable() :
                  renderChart(widget)}
            </div>
          </div>
        ))}
      </div>

      {/* Información de última actualización */}
      {dashboardData?.summary?.last_import && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <RefreshCw className="h-5 w-5 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Última importación de datos
              </p>
              <p className="text-sm text-blue-700">
                {format(new Date(dashboardData.summary.last_import), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}