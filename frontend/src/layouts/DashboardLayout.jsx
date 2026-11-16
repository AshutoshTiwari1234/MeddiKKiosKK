import AppSidebar from '../components/AppSidebar.jsx';

export default function DashboardLayout({ children }) {
  return <div className="dashboard-shell"><AppSidebar /><main className="main-area">{children}</main></div>;
}
