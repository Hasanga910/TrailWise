import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeRouteForRole } from '../auth/roleHome';
import { buttonClasses } from '../components/ui/buttonStyles';
import { StatusPage } from './StatusPage';

export function NotFoundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = user ? getHomeRouteForRole(user.role) : '/';
  return (
    <StatusPage
      code="404"
      title="This trail doesn't lead anywhere"
      message="The page you're looking for has moved or never existed. Let's get you back on the path."
      actions={
        <>
          <Link to={home} className={buttonClasses('primary')}>
            {user ? 'Back to my dashboard' : 'Back to home'}
          </Link>
          <button type="button" onClick={() => navigate(-1)} className={buttonClasses('secondary')}>
            Go back
          </button>
        </>
      }
    />
  );
}
