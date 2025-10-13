import type { JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import DesktopMessagesLayout from '@/app/layout/DesktopMessagesLayout'
import ThemeListPage from '@/pages/Theme/ui/ThemeListPage'
import ThemePage from '@/pages/Theme/ui/ThemePage'
import ExplorePage from '@/pages/Explore/ui/ExplorePage'
import LikesPage from '@/pages/Likes/ui/LikesPage'
import LikesHistoryPage from '@/pages/LikesHistory'
import ProfilePage from '@/pages/Profile/ui/ProfilePage'
import DesktopProfilePage from '@/pages/Profile/ui/DesktopProfilePage'
import MyProfilePage from '@/pages/MyProfile'
import DesktopMyProfilePage from '@/pages/MyProfile/ui/DesktopMyProfilePage'
import HelpPage from '@/pages/Help'
import PrivacyPage from '@/pages/Privacy'
import BlacklistPage from '@/pages/Blacklist'
import ThemeSettingsPage from '@/pages/ThemeSettings'
import RecommendationsPage from '@/pages/Recommendations'
import NotificationsPage from '@/pages/Notifications'
import AboutPositionPage from '@/pages/AboutPosition'
import { AdminPage, ModerationPage, UsersPage } from '@/pages/Admin'

export function MobileRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/theme" replace />} />
      <Route path="/theme" element={<ThemeListPage />} />
      <Route path="/theme/:chatId" element={<ThemePage />} />
      <Route path="/likes" element={<LikesPage />} />
      <Route path="/likes-history" element={<LikesHistoryPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/my-profile" element={<MyProfilePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/blacklist" element={<BlacklistPage />} />
      <Route path="/chat-settings" element={<ThemeSettingsPage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/about-position" element={<AboutPositionPage />} />
      
      {/* Админские роуты - всегда доступны, но защищены внутри компонентов */}
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/moderation" element={<ModerationPage />} />
      <Route path="/admin/users" element={<UsersPage />} />
      
      <Route path="*" element={<Navigate to="/theme" replace />} />
    </Routes>
  )
}

export function DesktopRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/theme" replace />} />
      <Route path="/theme" element={<DesktopMessagesLayout />} />
      <Route path="/theme/:chatId" element={<DesktopMessagesLayout />} />
      <Route path="/likes" element={<LikesPage />} />
      <Route path="/likes-history" element={<LikesHistoryPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/profile" element={<DesktopProfilePage />} />
      <Route path="/my-profile" element={<DesktopMyProfilePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/blacklist" element={<BlacklistPage />} />
      <Route path="/chat-settings" element={<ThemeSettingsPage />} />
      <Route path="/recommendations" element={<RecommendationsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/about-position" element={<AboutPositionPage />} />
      
      {/* Админские роуты - всегда доступны, но защищены внутри компонентов */}
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/moderation" element={<ModerationPage />} />
      <Route path="/admin/users" element={<UsersPage />} />
      
      <Route path="*" element={<Navigate to="/theme" replace />} />
    </Routes>
  )
}
