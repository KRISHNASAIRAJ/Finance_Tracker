/**
 * navigationRef — shared container ref usable from anywhere (App, DrawerMenu,
 * notification handlers). Lives outside App.tsx so shared components can
 * import it without a circular App↔component dependency.
 *
 * NOTE: this ref is valid for `isReady/getState/addEventListener` even when
 * used outside navigators — unlike `useNavigationState`, which throws when
 * the caller is not inside a navigator.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function getActiveRouteNameFromRef(): string | undefined {
  if (!navigationRef.isReady()) return undefined;
  try {
    return getActiveRouteName(navigationRef.getState());
  } catch {
    return undefined;
  }
}

/**
 * Recursively resolve the deepest active route name from a nav state object.
 */
export function getActiveRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes?.[state.index ?? 0];
  if (!route) return undefined;
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}
