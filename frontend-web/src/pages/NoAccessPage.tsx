import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { Button } from '../components/ui/Button';
import { buttonClasses } from '../components/ui/buttonStyles';
import { StatusPage } from './StatusPage';

export function NoAccessPage() {
  const { user, logout } = useAuth();
  return (
    <StatusPage
      code="403"
      title="You don't have access to this page"
      message="Your account's role doesn't include this area. If you think that's a mistake, contact an administrator."
      actions={
        <>
          <Link to={user ? getHomeRouteForRole(user.role) : '/login'} className={buttonClasses('primary')}>
            {user ? 'Go to my dashboard' : 'Sign in'}
          </Link>
          {user && (
            <Button variant="secondary" onClick={logout}>
              Switch account
            </Button>
          )}
        </>
      }
    />
  );
}
