# @alloomi/integrations

Unified package for Alloomi integration packages.

## Packages

This umbrella package exports the following integration packages:

- `@alloomi/integrations/asana` - Asana task integration
- `@alloomi/integrations/calendar` - Google Calendar and Outlook Calendar adapters
- `@alloomi/integrations/channels` - Message platform adapters (Slack, Discord, Telegram, etc.)
- `@alloomi/integrations/hubspot` - HubSpot CRM integration
- `@alloomi/integrations/imessage` - macOS iMessage adapter

## Usage

```typescript
// Import from umbrella package
import { AsanaClient } from "@alloomi/integrations/asana";
import { GoogleCalendarAdapter } from "@alloomi/integrations/calendar";
import { MessagePlatformAdapter } from "@alloomi/integrations/channels";
import { HubspotClient } from "@alloomi/integrations/hubspot";
import { IMessageAdapter } from "@alloomi/integrations/imessage";

// Or import specific sub-paths
import type { Platform } from "@alloomi/integrations/channels/sources/types";
```

## Architecture

Each integration package is self-contained with its own `package.json` and `tsconfig.json`. The umbrella package (`@alloomi/integrations`) re-exports all packages through sub-path exports, allowing consumers to import from a single package while maintaining package separation.
