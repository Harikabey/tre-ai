import { useLocalScheduler } from '@/hooks/useLocalScheduler';
import { useAuth } from '@/hooks/useAuth';

/** Headless runner: keeps daily / inactivity / auto-clean checks alive while the app is open. */
const LocalSchedulerRunner = () => {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return <AuthenticatedSchedulerRunner />;
};

const AuthenticatedSchedulerRunner = () => {
  useLocalScheduler();
  return null;
};

export default LocalSchedulerRunner;
