// Decides what to show: the welcome page, or the app with its pages.
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Welcome from "./auth/Welcome";
import AppLayout from "./layout/AppLayout";
import { PostsProvider } from "./discover/PostsProvider";
import DiscoverPage from "./discover/DiscoverPage";
import PostDetail from "./discover/PostDetail";
import NewPostPage from "./discover/NewPostPage";
import { GroupsProvider } from "./groups/GroupsProvider";
import GroupsPage from "./groups/GroupsPage";
import GroupChat from "./groups/GroupChat";
import Profile from "./pages/Profile";
import { TripProvider } from "./trip/store";
import { SyncProvider } from "./trip/SyncProvider";
import TripLayout from "./trip/pages/TripLayout";
import Dashboard from "./trip/pages/Dashboard";
import ImportPage from "./trip/pages/ImportPage";
import Transactions from "./trip/pages/Transactions";
import Checklist from "./trip/pages/Checklist";
import Settings from "./trip/pages/Settings";
import RoutePage from "./trip/pages/Route";
import Budgets from "./trip/pages/Budgets";
import Countries from "./trip/pages/Countries";
import CountryDetail from "./trip/pages/CountryDetail";
import Afford from "./trip/pages/Afford";

export default function Root() {
  const { loading, session, demo } = useAuth();
  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-4xl">🌍</div>;
  }
  if (!session && !demo) return <Welcome />;

  // Each account gets its own private storage on this device; the demo has its own too.
  const scope = session ? session.user.id : "demo";
  return (
    <TripProvider key={scope} scope={scope}>
      <SyncProvider>
      <GroupsProvider key={scope}>
      <PostsProvider key={scope}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/discover/:id" element={<PostDetail />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupChat />} />
            <Route path="/post" element={<NewPostPage />} />
            <Route path="/trip" element={<TripLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="route" element={<RoutePage />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="countries" element={<Countries />} />
              <Route path="countries/:name" element={<CountryDetail />} />
              <Route path="afford" element={<Afford />} />
              <Route path="checklist" element={<Checklist />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Route>
        </Routes>
      </PostsProvider>
      </GroupsProvider>
      </SyncProvider>
    </TripProvider>
  );
}
