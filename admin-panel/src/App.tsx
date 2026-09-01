import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ArticleListPage } from './pages/articles/ArticleListPage';
import { ArticleFormPage } from './pages/articles/ArticleFormPage';
import { CategoryListPage } from './pages/categories/CategoryListPage';
import { CategoryFormPage } from './pages/categories/CategoryFormPage';
import { TagListPage } from './pages/tags/TagListPage';
import { TagFormPage } from './pages/tags/TagFormPage';
import { UserListPage } from './pages/users/UserListPage';
import { UserFormPage } from './pages/users/UserFormPage';
import { MediaListPage } from './pages/media/MediaListPage';
import { PageListPage } from './pages/pages/PageListPage';
import { PageFormPage } from './pages/pages/PageFormPage';
import { SiteSettingsPage } from './pages/settings/SiteSettingsPage';
import { SeoSettingsPage } from './pages/seo/SeoSettingsPage';
import { ContactMessageListPage } from './pages/inquiries/ContactMessageListPage';
import { ContactMessageDetailPage } from './pages/inquiries/ContactMessageDetailPage';
import { HelpPage } from './pages/HelpPage';
import { BackupsPage } from './pages/backups/BackupsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="articles" element={<ArticleListPage />} />
        <Route path="articles/new" element={<ArticleFormPage />} />
        <Route path="articles/:id" element={<ArticleFormPage />} />
        <Route path="categories" element={<CategoryListPage />} />
        <Route path="categories/new" element={<CategoryFormPage />} />
        <Route path="categories/:id" element={<CategoryFormPage />} />
        <Route path="tags" element={<TagListPage />} />
        <Route path="tags/new" element={<TagFormPage />} />
        <Route path="tags/:id" element={<TagFormPage />} />
        <Route path="media" element={<MediaListPage />} />
        <Route path="pages" element={<PageListPage />} />
        <Route path="pages/:id" element={<PageFormPage />} />
        <Route path="inquiries" element={<ContactMessageListPage />} />
        <Route path="inquiries/:id" element={<ContactMessageDetailPage />} />
        <Route path="seo" element={<SeoSettingsPage />} />
        <Route path="users" element={<UserListPage />} />
        <Route path="users/new" element={<UserFormPage />} />
        <Route path="users/:id" element={<UserFormPage />} />
        <Route path="settings" element={<SiteSettingsPage />} />
        <Route path="backups" element={<BackupsPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
    </Routes>
  );
}

export default App;
