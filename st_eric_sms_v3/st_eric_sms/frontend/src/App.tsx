import { Navigate, Route, Routes } from "react-router-dom";
import { session } from "./lib/api";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";
import MarkEntry from "./pages/MarkEntry";
import ReportCards from "./pages/ReportCards";
import Attendance from "./pages/Attendance";
import Insights from "./pages/Insights";
import Library from "./pages/Library";
import Announcements from "./pages/Announcements";
import Admin from "./pages/Admin";
import Apply from "./pages/Apply";
import Applications from "./pages/Applications";
import Assignments from "./pages/Assignments";
import Calendar from "./pages/Calendar";
import Candidates from "./pages/Candidates";
import Fees from "./pages/Fees";
import Notices from "./pages/Notices";
import Setup from "./pages/Setup";
import Timetable from "./pages/Timetable";

function Guard({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  if (!session.token()) return <Navigate to="/login" replace />;
  if (session.mustChange()) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(session.role())) return <Navigate to="/dashboard" replace />;
  return children;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/verify/:sid/:term/:year/:sig" element={<Verify />} />
      <Route path="/apply" element={<Apply />} />
      <Route element={<Guard><Shell /></Guard>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/marks" element={<Guard roles={["teacher", "admin"]}><MarkEntry /></Guard>} />
        <Route path="/report-cards" element={<Guard roles={["admin", "teacher", "student", "parent"]}><ReportCards /></Guard>} />
        <Route path="/attendance" element={<Guard roles={["teacher", "admin"]}><Attendance /></Guard>} />
        <Route path="/insights" element={<Guard roles={["teacher", "admin"]}><Insights /></Guard>} />
        <Route path="/library" element={<Guard roles={["admin", "teacher", "librarian", "student"]}><Library /></Guard>} />
        <Route path="/announcements" element={<Guard roles={["admin", "teacher", "student", "parent"]}><Announcements /></Guard>} />
        <Route path="/assignments" element={<Guard roles={["admin", "teacher", "student", "parent"]}><Assignments /></Guard>} />
        <Route path="/calendar" element={<Guard roles={["admin", "teacher", "librarian", "student", "parent"]}><Calendar /></Guard>} />
        <Route path="/notices" element={<Guard roles={["admin", "teacher", "student", "parent"]}><Notices /></Guard>} />
        <Route path="/timetable" element={<Guard roles={["admin", "teacher", "student", "parent"]}><Timetable /></Guard>} />
        <Route path="/fees" element={<Guard roles={["admin", "student", "parent"]}><Fees /></Guard>} />
        <Route path="/candidates" element={<Guard roles={["admin"]}><Candidates /></Guard>} />
        <Route path="/applications" element={<Guard roles={["admin"]}><Applications /></Guard>} />
        <Route path="/setup" element={<Guard roles={["admin"]}><Setup /></Guard>} />
        <Route path="/admin" element={<Guard roles={["admin"]}><Admin /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
