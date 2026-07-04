// Single source of truth for navigable pages — shared by the customizable
// mobile bottom navbar (MobileBottomNav / CustomizeNavbar) and the Cowork feature.
import {
  MessageSquare,
  Compass,
  Calendar,
  Play,
  User,
  Newspaper,
  Mail,
  Bell,
  Coffee,
  UserCircle,
  Settings,
  MessageCircle,
} from 'lucide-react';

export const NAV_PAGES = [
  { id: 'feed', path: '/feed', icon: MessageSquare, labelKey: 'mobileNav.home' },
  { id: 'discover', path: '/discover', icon: Compass, labelKey: 'mobileNav.discover' },
  { id: 'events', path: '/events', icon: Calendar, labelKey: 'mobileNav.events' },
  { id: 'media', path: '/media', icon: Play, labelKey: 'nav.media' },
  { id: 'dashboard', path: '/dashboard', icon: User, labelKey: 'mobileNav.dashboard', auth: true },
  { id: 'news', path: '/news', icon: Newspaper, labelKey: 'mobileNav.news' },
  { id: 'messages', path: '/messages', icon: Mail, labelKey: 'nav.messages', auth: true },
  { id: 'notifications', path: '/notifications', icon: Bell, labelKey: 'customNav.pages.notifications', auth: true },
  { id: 'cowork', path: '/cowork', icon: Coffee, labelKey: 'mobileNav.cowork', auth: true },
  { id: 'profile', path: '/profile', icon: UserCircle, labelKey: 'nav.profile', auth: true },
  { id: 'settings', path: '/settings', icon: Settings, labelKey: 'nav.settings', auth: true },
  { id: 'feedback', path: '/feedback', icon: MessageCircle, labelKey: 'customNav.pages.feedback' },
];

export const NAV_PAGES_BY_ID = Object.fromEntries(NAV_PAGES.map((p) => [p.id, p]));

export const DEFAULT_BOTTOM_NAV = ['feed', 'discover', 'events', 'media', 'dashboard'];

export const MAX_TABS = 5;
export const MIN_TABS = 1;

/**
 * Sanitize a stored/received list of tab ids into a valid bottom-nav config.
 * Pure function: filters unknown ids, dedupes (first occurrence wins),
 * caps at MAX_TABS, and falls back to the defaults when invalid or empty.
 */
export function sanitizeTabs(ids) {
  if (!Array.isArray(ids)) return [...DEFAULT_BOTTOM_NAV];
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (NAV_PAGES_BY_ID[id] && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  const sliced = result.slice(0, MAX_TABS);
  if (sliced.length < MIN_TABS) return [...DEFAULT_BOTTOM_NAV];
  return sliced;
}
