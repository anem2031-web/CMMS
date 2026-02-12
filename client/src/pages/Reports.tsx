import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from "@shared/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function Reports() {
  const { data: byStatus, isLoading: l1 } = trpc.reports.ticketsByStatus.useQuery();
  const { data: byCategory, isLoading: l2 } = trpc.reports.ticketsByCategory.useQuery();
  const { data: byPriority, isLoading: l3 } = trpc.reports.ticketsByPriority.useQuery();
  const { data: costData, isLoading: l4 } = trpc.reports.costComparison.useQuery();
  const { data: monthly, isLoading: l5 } = trpc.reports.monthlySummary.useQuery();

  const statusData = byStatus?.map(d => ({ name: STATUS_LABELS[d.status] || d.status, value: d.count })) || [];
  const categoryData = byCategory?.map(d => ({ name: CATEGORY_LABELS[d.category] || d.category, value: d.count })) || [];
  const priorityData = byPriority?.map(d => ({ name: PRIORITY_LABELS[d.priority] || d.priority, value: d.count })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التقارير</h1>
        <p className="text-sm text-muted-foreground mt-1">تحليلات وإحصائيات شاملة عن عمليات الصيانة</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets by Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">البلاغات حسب الحالة</CardTitle></CardHeader>
          <CardContent>
            {l1 ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Category */}
        <Card>
          <CardHeader><CardTitle className="text-base">البلاغات حسب الفئة</CardTitle></CardHeader>
          <CardContent>
            {l2 ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Priority */}
        <Card>
          <CardHeader><CardTitle className="text-base">البلاغات حسب الأولوية</CardTitle></CardHeader>
          <CardContent>
            {l3 ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label>
                    {priorityData.map((_, i) => <Cell key={i} fill={["#10b981", "#f59e0b", "#f97316", "#ef4444"][i] || COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost Comparison */}
        <Card>
          <CardHeader><CardTitle className="text-base">مقارنة التكلفة التقديرية والفعلية</CardTitle></CardHeader>
          <CardContent>
            {l4 ? <Skeleton className="h-64 w-full" /> : costData && costData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="poNumber" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="estimated" name="تقديري" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="فعلي" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات تكلفة بعد</p>}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">الاتجاه الشهري للبلاغات</CardTitle></CardHeader>
          <CardContent>
            {l5 ? <Skeleton className="h-64 w-full" /> : monthly && monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" name="تم إنشاؤها" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="closed" name="تم إغلاقها" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات شهرية بعد</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
