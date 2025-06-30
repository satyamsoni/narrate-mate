
import HomePage from '../pages/home.f7';
import CatalogPage from '../pages/catalog.f7';
import SettingsPage from '../pages/settings.f7';

var routes = [
  {
    path: '/',
    component: HomePage,
  },
  {
    path: '/catalog/',
    component: CatalogPage,
  },
  {
    path: '/settings/',
    component: SettingsPage,
  }
];

export default routes;