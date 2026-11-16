import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-shell" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main className="dashboard-main" style={{ flex: 1, minWidth: 0, padding: 32, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
