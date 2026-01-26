# Client Portal Mobile App - Design Guidelines

## Brand Identity
**Purpose**: Empower clients of a plumbing/heating/electrical service company to manage their account, track services, and get expert help—all from their phone.

**Aesthetic Direction**: Professional/refined with warmth. Clean, trustworthy interface that feels capable and reassuring—like a reliable technician. NOT corporate-cold, but approachable and confident.

**Memorable Element**: Seamless integration between account management and AI assistance. The floating "Ask VAI" button is always accessible, making expert help feel one tap away.

## Navigation Architecture
**Root Navigation**: Tab Bar (4 tabs)
- **Home** - Dashboard overview
- **Services** - Bookings, history, plans
- **AI Chat** - VAI assistant integration
- **Account** - Profile, settings, contacts

**Auth Flow**: Required (SSO preferred)
- Apple Sign-In (iOS)
- Google Sign-In (Android/cross-platform)
- Include privacy policy/terms links
- Account deletion nested under Settings > Account > Delete Account (double confirmation)

## Screen-by-Screen Specifications

### 1. Login/Signup
- Stack-only screen (pre-tab navigation)
- Transparent header
- Scrollable content with logo at top, SSO buttons centered
- Safe area: top = insets.top + Spacing.xl, bottom = insets.bottom + Spacing.xl

### 2. Home (Dashboard)
- Tab: Home
- Transparent header with company logo left, notifications icon right
- Scrollable content showing: Quick actions (Book Service, Contact Support), Service summary cards (Active Plans, Upcoming Jobs), Recent invoices
- Safe area: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl

### 3. Services List
- Tab: Services
- Default header with title "Services", filter icon right
- List view with sections: Active Plans, Job History, Invoices, Certificates
- Tapping item navigates to detail screen
- Empty state for each section if no data
- Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl

### 4. Service Detail
- Modal stack screen
- Default header with back button, title (job ID or plan name)
- Scrollable form-style layout showing all details, timestamps, status
- Action buttons at bottom (Download PDF, Contact Support)
- Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

### 5. Book Service
- Modal stack screen
- Default header with Cancel left, title "Book Service"
- Scrollable form: Service type dropdown, Appliance/asset selector, Date/time picker, Notes textarea
- Submit button in header right ("Book")
- Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

### 6. AI Chat (VAI)
- Tab: AI Chat
- Transparent header with "VAI Assistant" title
- Chat interface (scrollable message list, input at bottom)
- Messages use chat bubbles (user vs AI)
- Fixed input bar with safe area: bottom = tabBarHeight + Spacing.xl
- Safe area: top = headerHeight + Spacing.xl

### 7. Account
- Tab: Account
- Transparent header with "Account" title, settings icon right
- Scrollable content: Avatar/name section, Contacts list (editable), Appliances/assets list
- Safe area: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl

### 8. Edit Contact
- Modal stack screen
- Default header with Cancel left, Save right
- Scrollable form for contact details
- Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

### 9. Settings
- Modal stack screen
- Default header with back button, "Settings" title
- Scrollable list: Profile, Notifications, Privacy Policy, Terms, Log Out, Account section with Delete Account
- Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

## Color Palette
- **Primary**: #1E5A8E (deep trustworthy blue)
- **Accent**: #E47D3C (warm orange for actions)
- **Background**: #F8F9FA (soft off-white)
- **Surface**: #FFFFFF
- **Text Primary**: #1A1A1A
- **Text Secondary**: #6B7280
- **Border**: #E5E7EB
- **Success**: #10B981
- **Warning**: #F59E0B
- **Error**: #EF4444

## Typography
- **Font Family**: System (San Francisco for iOS, Roboto for Android)
- **Heading Large**: 28pt Bold
- **Heading**: 20pt Semibold
- **Subheading**: 16pt Semibold
- **Body**: 15pt Regular
- **Caption**: 13pt Regular
- **Button**: 16pt Semibold

## Visual Design
- Touchable feedback: Scale 0.95 + opacity 0.7
- Floating buttons: Shadow (offset 0,2 | opacity 0.10 | radius 2)
- Icons: Feather icons from @expo/vector-icons
- Card shadows: Subtle elevation (offset 0,1 | opacity 0.05 | radius 4)

## Assets to Generate
1. **icon.png** - App icon featuring stylized home with wrench/tool symbol, blue/orange color scheme | WHERE USED: Device home screen
2. **splash-icon.png** - Simplified version of app icon | WHERE USED: Launch screen
3. **empty-services.png** - Minimalist illustration of calendar with checkmark | WHERE USED: Services tab when no active plans
4. **empty-jobs.png** - Simple illustration of toolbox | WHERE USED: Job history when empty
5. **empty-invoices.png** - Illustration of document with checkmark | WHERE USED: Invoices section when empty
6. **default-avatar.png** - Professional circular avatar placeholder (initials style) | WHERE USED: Account profile section
7. **vai-welcome.png** - Friendly illustration of AI assistant icon (abstract, professional) | WHERE USED: AI Chat tab empty state