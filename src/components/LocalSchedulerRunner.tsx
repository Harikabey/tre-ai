import { useLocalScheduler } from '@/hooks/useLocalScheduler';

/** Headless runner: keeps daily / inactivity / auto-clean checks alive while the app is open. */
const LocalSchedulerRunner = () => {
  useLocalScheduler();
  return null;
};

export default LocalSchedulerRunner;
