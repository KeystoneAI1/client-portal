# Client Portal Mobile App

## Overview

A cross-platform mobile application built with React Native and Expo that serves as a client portal for a plumbing/heating/electrical service company. The app enables customers to manage their accounts, track service history, view invoices and certificates, book new services, and get AI-powered assistance through an integrated virtual assistant (VAI).

The application follows a professional yet approachable design aesthetic, emphasizing trustworthiness and reliability. It supports iOS, Android, and web platforms through Expo's universal architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React Native with Expo SDK 54, using the new architecture and React 19.1

**Navigation**: React Navigation v7 with a nested structure:
- Root stack navigator handles auth flow and modal screens
- Bottom tab navigator for main app sections (Home, Services, AI Chat, Account)
- Individual stack navigators per tab for screen-specific flows

**State Management**:
- React Query (TanStack Query) for server state and API caching
- React Context for authentication state (`AuthProvider`)
- Local component state with React hooks for UI state

**Styling Approach**:
- StyleSheet API with a centralized theme system (`constants/theme.ts`)
- Light/dark mode support via `useColorScheme` hook
- Design tokens for spacing, typography, colors, and border radius
- Platform-specific adaptations for iOS blur effects and Android material design

**Key UI Patterns**:
- Animated components using Reanimated for micro-interactions
- Keyboard-aware scrolling with platform-specific handling
- Safe area insets management throughout
- Haptic feedback for touch interactions

### Backend Architecture

**Runtime**: Node.js with Express 5, using TypeScript compiled with tsx/esbuild

**API Design**: RESTful endpoints under `/api/` prefix with CORS configured for Replit domains and localhost development

**Key Endpoints**:
- `/api/chat` - Proxies requests to external VAI AI service for chat functionality
- `/api/commusoft/*` - Integration routes for Commusoft field service management API

**Database**: PostgreSQL with Drizzle ORM
- Schema defined in `shared/schema.ts` using Drizzle's pgTable definitions
- Migrations managed via drizzle-kit
- Currently uses in-memory storage (`MemStorage`) as fallback

### Data Storage Solutions

**Client-Side**: AsyncStorage for persistent local data including:
- Authentication tokens
- User profile data
- Cached service data (contacts, appliances, service plans, jobs, invoices, certificates)
- Chat message history

**Server-Side**: PostgreSQL database (when provisioned) with Drizzle ORM for type-safe queries

### Authentication

**Current Implementation**: Mock authentication flow with email/password
- Designed for SSO integration (Apple Sign-In, Google Sign-In) as noted in design guidelines
- Auth state managed via React Context
- Token-based session persistence in AsyncStorage

### External Integrations

**AI Chat Service**: External VAI API (`vai.keystoneai.tech`) for virtual assistant functionality
- System prompt customized for plumbing/heating/electrical domain expertise
- Conversation history maintained for context

**Commusoft Integration**: Field service management API integration
- Token-based authentication with credential caching
- Endpoints for retrieving customer data from external system
- **API Limitations**:
  1. The `/api/v1/diaryevents` endpoint is engineer-focused (requires engineer ID), not customer-facing. Scheduled appointments for customers are not directly available via API. The app uses jobs with "ongoing" status to identify work in progress instead.
  2. The `/api/v1/suggested-appointments` endpoint consistently returns "400 - Invalid Data" for all tested request formats. Extensive testing has been done with OpenAI-assisted research including:
     - String and integer IDs (contactid, propertyid, jobdescriptionid)
     - CamelCase keys (customerId, propertyId) and snake_case keys (customer_id, property_id)
     - With and without dates, postcode, duration, usergroupsid, branch_id
     - Minimal and full field sets
     - Wrapped (suggestedappointment:{...}) and flat JSON formats
     - Both dev endpoint (webservice_dev.php) and prod endpoint (webservice_prod_uk.php)
     - X-Requested-With header and Accept: application/json header
     All return "Invalid Data". The app generates fallback appointment slots (weekday mornings 9-12, afternoons 1-5) when the API is unavailable. To enable real Commusoft suggested appointments, contact Commusoft support for API documentation specific to your account.

## External Dependencies

### Third-Party Services
- **VAI API** (`vai.keystoneai.tech`): AI chat service for virtual assistant
- **Commusoft API** (`app.commusoft.co.uk`): Field service management platform for customer/job data

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `COMMUSOFT_COMPANY_ID`: Commusoft client identifier
- `COMMUSOFT_USERNAME`: API authentication username
- `COMMUSOFT_PASSWORD`: API authentication password
- `COMMUSOFT_API_KEY`: Commusoft application ID
- `EXPO_PUBLIC_DOMAIN`: Public domain for API requests
- `REPLIT_DEV_DOMAIN`: Development domain (Replit-specific)

### Key NPM Dependencies
- **expo**: Universal app platform and build tooling
- **react-navigation**: Navigation framework with native stack and bottom tabs
- **@tanstack/react-query**: Server state management
- **drizzle-orm**: Type-safe SQL ORM
- **react-native-reanimated**: Animation library
- **react-native-keyboard-controller**: Keyboard handling
- **expo-haptics**: Haptic feedback
- **expo-blur**: iOS blur effects