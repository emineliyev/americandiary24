from rest_framework import permissions


def _is_administrator(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.groups.filter(name='Administrator').exists()))


class IsAdministratorOnly(permissions.BasePermission):
    """For the Users endpoint: account credentials, roles, and journalist
    profiles are managed exclusively by Administrator — not even Baş
    Redaktor — and the list isn't readable by anyone else either, since it
    carries every staff member's email/username."""

    def has_permission(self, request, view):
        return _is_administrator(request.user)


class IsAdministratorOrReadOnly(permissions.BasePermission):
    """For Author: every authenticated role can read it (the Article form's
    author picker needs that), but only Administrator can create/edit/delete
    — it's now managed exclusively from the Users screen."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return _is_administrator(request.user)


_MEDIA_MANAGER_GROUPS = {'Administrator', 'Baş Redaktor'}


class IsMediaManager(permissions.BasePermission):
    """Deleting a shared Media Library asset can break someone else's
    article/avatar — restricted to the same manager tier as Categories/Tags
    (see IsTaxonomyManagerOrReadOnly), unlike browsing/uploading/organizing
    which any authenticated role can do."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.groups.filter(name__in=_MEDIA_MANAGER_GROUPS).exists()))
