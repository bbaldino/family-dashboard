# Packages Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a packages widget showing active shipments and recently delivered packages from an external packages service, with a tap-to-expand tracking detail modal.

**Architecture:** Rust/Axum backend proxies requests to an external packages service (configurable URL). React frontend renders a `PackagesWidget` with shipment rows and a new shared `Modal` component for tracking event detail. The widget replaces the top half of column 2, pushing chores down.

**Tech Stack:** Rust, Axum, reqwest, React, TypeScript, TanStack Query, Zod

**Spec:** `docs/superpowers/specs/2026-03-17-packages-integration-design.md`

---

## File Structure

### Backend (`backend/src/integrations/packages/`)

| File | Responsibility |
|------|---------------|
| `mod.rs` | Module exports, `INTEGRATION_ID`, `router()` function |
| `routes.rs` | Proxy route handlers: `get_shipments`, `get_shipment_events` |

### Frontend (`frontend/src/integrations/packages/`)

| File | Responsibility |
|------|---------------|
| `config.ts` | `defineIntegration()` with Zod schema |
| `types.ts` | TypeScript types for shipment and event API responses |
| `usePackages.ts` | TanStack Query hook for fetching shipments |
| `PackagesWidget.tsx` | Main widget with shipment list |
| `ShipmentRow.tsx` | Single shipment row with icon, name, carrier, ETA |
| `PackageDetailModal.tsx` | Modal showing tracking event timeline |
| `index.ts` | Barrel export |

### Shared UI

| File | Responsibility |
|------|---------------|
| `frontend/src/ui/Modal.tsx` | New reusable centered modal overlay component |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Add `pub mod packages;` and `.nest("/packages", ...)` |
| `frontend/src/integrations/registry.ts` | Add `packagesIntegration` to array |
| `frontend/src/boards/HomeBoard.tsx` | Add `PackagesWidget` in col 2 row 2, move chores to row 3 only |

---

## Chunk 1: Backend + Frontend Foundation

### Task 1: Backend proxy routes

**Files:**
- Create: `backend/src/integrations/packages/mod.rs`
- Create: `backend/src/integrations/packages/routes.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create the packages module**

Create `backend/src/integrations/packages/mod.rs`:
```rust
pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "packages";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/shipments", axum::routing::get(routes::get_shipments))
        .route(
            "/shipments/{id}/events",
            axum::routing::get(routes::get_shipment_events),
        )
        .with_state(pool)
}
```

- [ ] **Step 2: Create the proxy route handlers**

Create `backend/src/integrations/packages/routes.rs`:
```rust
use axum::Json;
use axum::extract::{Path, State};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

const DEFAULT_SERVICE_URL: &str = "http://localhost:4000/api/ext/packages";

async fn service_url(pool: &SqlitePool) -> Result<String, AppError> {
    let config = IntegrationConfig::new(pool, INTEGRATION_ID);
    let url = config
        .get_or("service_url", DEFAULT_SERVICE_URL)
        .await?;
    // Normalize: strip trailing slash
    Ok(url.trim_end_matches('/').to_string())
}

async fn proxy_get(
    pool: &SqlitePool,
    path: &str,
) -> Result<Json<serde_json::Value>, AppError> {
    let base = service_url(pool).await?;
    let url = format!("{}{}", base, path);

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| AppError::Internal(format!("Packages service unavailable: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Packages service error ({}): {}",
            status, body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Packages parse error: {}", e)))?;

    Ok(Json(data))
}

/// GET /api/packages/shipments — proxy to packages service
pub async fn get_shipments(
    State(pool): State<SqlitePool>,
) -> Result<Json<serde_json::Value>, AppError> {
    proxy_get(&pool, "/shipments").await
}

/// GET /api/packages/shipments/:id/events — proxy to packages service
pub async fn get_shipment_events(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    proxy_get(&pool, &format!("/shipments/{}/events", id)).await
}
```

- [ ] **Step 3: Register the packages module**

In `backend/src/integrations/mod.rs`, add `pub mod packages;` with the other module declarations, and add `.nest("/packages", packages::router(pool.clone()))` in the `router()` function.

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && cargo check`

- [ ] **Step 5: Format and commit**

```bash
cd backend && cargo +nightly fmt
git add backend/src/integrations/packages/ backend/src/integrations/mod.rs
git commit -m "feat(packages): add backend proxy routes to packages service"
```

---

### Task 2: Frontend types, config, and hook

**Files:**
- Create: `frontend/src/integrations/packages/types.ts`
- Create: `frontend/src/integrations/packages/config.ts`
- Create: `frontend/src/integrations/packages/usePackages.ts`
- Create: `frontend/src/integrations/packages/index.ts`
- Create: `frontend/src/integrations/packages/PackagesWidget.tsx` (placeholder)
- Modify: `frontend/src/integrations/registry.ts`

- [ ] **Step 1: Create TypeScript types**

Create `frontend/src/integrations/packages/types.ts`:
```typescript
export interface Shipment {
  id: string
  name: string
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  expectedDelivery: string | null
  trackingUrl: string | null
  orderUrl: string | null
  notes: string
  createdAt: string
  updatedAt: string
  eventCount: number
}

export type ShipmentStatus =
  | 'unknown'
  | 'label_created'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned'
  | 'cancelled'

export interface TrackingEvent {
  id: string
  shipmentId: string
  status: string
  location: string | null
  description: string
  occurredAt: string
  source: string
  createdAt: string
}

export interface ShipmentsResponse {
  shipments: Shipment[]
}

export interface EventsResponse {
  events: TrackingEvent[]
}

export const STATUS_ICONS: Record<ShipmentStatus, string> = {
  label_created: '\uD83D\uDCCB',
  shipped: '\uD83D\uDCE6',
  in_transit: '\uD83D\uDCE6',
  out_for_delivery: '\uD83D\uDE9A',
  delivered: '\u2705',
  exception: '\u26A0\uFE0F',
  returned: '\u21A9\uFE0F',
  cancelled: '\u274C',
  unknown: '\u2753',
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  label_created: 'Label created',
  shipped: 'Shipped',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Exception',
  returned: 'Returned',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
}
```

- [ ] **Step 2: Create integration config**

Create `frontend/src/integrations/packages/config.ts`:
```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const packagesIntegration = defineIntegration({
  id: 'packages',
  name: 'Packages',
  schema: z.object({
    service_url: z.string().optional().default('http://localhost:4000/api/ext/packages'),
  }),
  fields: {
    service_url: {
      label: 'Packages Service URL',
      description: 'Base URL of the packages tracking service',
    },
  },
})
```

- [ ] **Step 3: Create data-fetching hook**

Create `frontend/src/integrations/packages/usePackages.ts`:
```typescript
import { useQuery } from '@tanstack/react-query'
import { packagesIntegration } from './config'
import type { ShipmentsResponse } from './types'

export function usePackages() {
  return useQuery({
    queryKey: ['packages', 'shipments'],
    queryFn: () => packagesIntegration.api.get<ShipmentsResponse>('/shipments'),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  })
}
```

- [ ] **Step 4: Create placeholder widget and barrel export**

Create `frontend/src/integrations/packages/PackagesWidget.tsx`:
```typescript
export function PackagesWidget() {
  return <div>Packages placeholder</div>
}
```

Create `frontend/src/integrations/packages/index.ts`:
```typescript
export { PackagesWidget } from './PackagesWidget'
export { packagesIntegration } from './config'
```

- [ ] **Step 5: Register in the integration registry**

In `frontend/src/integrations/registry.ts`, add:
```typescript
import { packagesIntegration } from './packages/config'
```
Add `packagesIntegration` to the `integrations` array.

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/integrations/packages/ frontend/src/integrations/registry.ts
git commit -m "feat(packages): add frontend types, config, and data hook"
```

---

### Task 3: Shared Modal component

**Files:**
- Create: `frontend/src/ui/Modal.tsx`

- [ ] **Step 1: Create the Modal component**

Create `frontend/src/ui/Modal.tsx` following the same pattern as `BottomSheet.tsx`:
```typescript
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-bg-overlay animate-[fadeIn_200ms_ease-out]" />
      <div
        className="relative w-[min(480px,90vw)] max-h-[80vh] bg-bg-card rounded-[var(--radius-card)] shadow-lg animate-[fadeIn_200ms_ease-out] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border sticky top-0 bg-bg-card z-10">
          {title && (
            <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] text-text-muted hover:text-text-secondary hover:bg-bg-card-hover transition-colors ml-auto"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/ui/Modal.tsx
git commit -m "feat(ui): add shared Modal component for centered overlays"
```

---

## Chunk 2: Widget Components + Integration

### Task 4: ShipmentRow component

**Files:**
- Create: `frontend/src/integrations/packages/ShipmentRow.tsx`

- [ ] **Step 1: Create the shipment row component**

Create `frontend/src/integrations/packages/ShipmentRow.tsx`:
```typescript
import type { Shipment } from './types'
import { STATUS_ICONS, STATUS_LABELS } from './types'

function formatEta(expectedDelivery: string | null): { text: string; color: string } {
  if (!expectedDelivery) return { text: '', color: 'text-text-muted' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delivery = new Date(expectedDelivery + 'T00:00:00')

  const diffDays = Math.round((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return { text: 'Today', color: 'text-success' }
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-[#c06830]' }

  const formatted = delivery.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return { text: formatted, color: 'text-text-muted' }
}

function formatDeliveredAgo(updatedAt: string): string {
  const updated = new Date(updatedAt)
  const now = new Date()
  const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

interface ShipmentRowProps {
  shipment: Shipment
  onClick: () => void
}

export function ShipmentRow({ shipment, onClick }: ShipmentRowProps) {
  const isDelivered = shipment.status === 'delivered'
  const icon = STATUS_ICONS[shipment.status] ?? '\u2753'
  const eta = formatEta(shipment.expectedDelivery)

  return (
    <div
      className="flex items-center gap-[10px] py-[8px] border-b border-border last:border-b-0 cursor-pointer hover:bg-bg-card-hover rounded-lg px-1 -mx-1 transition-colors"
      onClick={onClick}
    >
      <div className={`text-[20px] flex-shrink-0 ${isDelivered ? 'opacity-40' : ''}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-medium truncate ${isDelivered ? 'text-text-muted' : 'text-text-primary'}`}>
          {shipment.name}
        </div>
        <div className="text-[11px] text-text-muted">
          <span className="font-medium text-text-secondary">{shipment.carrier}</span>
          {isDelivered
            ? ` · ${formatDeliveredAgo(shipment.updatedAt)}`
            : ` · ${STATUS_LABELS[shipment.status]}`
          }
        </div>
      </div>
      {!isDelivered && eta.text && (
        <div className="flex-shrink-0 text-right">
          <div className={`text-[13px] font-semibold ${eta.color}`}>{eta.text}</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/packages/ShipmentRow.tsx
git commit -m "feat(packages): add ShipmentRow component with status icons and ETA"
```

---

### Task 5: PackageDetailModal component

**Files:**
- Create: `frontend/src/integrations/packages/PackageDetailModal.tsx`

- [ ] **Step 1: Create the package detail modal**

Create `frontend/src/integrations/packages/PackageDetailModal.tsx`:
```typescript
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/ui/Modal'
import { packagesIntegration } from './config'
import type { Shipment, EventsResponse } from './types'
import { STATUS_ICONS } from './types'

interface PackageDetailModalProps {
  shipment: Shipment | null
  onClose: () => void
}

export function PackageDetailModal({ shipment, onClose }: PackageDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['packages', 'events', shipment?.id],
    queryFn: () =>
      packagesIntegration.api.get<EventsResponse>(`/shipments/${shipment!.id}/events`),
    enabled: !!shipment,
  })

  if (!shipment) return null

  const events = data?.events ?? []
  const icon = STATUS_ICONS[shipment.status] ?? '\u2753'

  return (
    <Modal isOpen={!!shipment} onClose={onClose} title={shipment.name}>
      <div className="space-y-4">
        {/* Status + carrier info */}
        <div className="flex items-center gap-3">
          <span className="text-[24px]">{icon}</span>
          <div>
            <div className="text-[14px] font-medium text-text-primary">
              {shipment.carrier}
            </div>
            {shipment.trackingNumber && (
              <div className="text-[12px] text-text-muted font-mono">
                {shipment.trackingNumber}
              </div>
            )}
          </div>
          {shipment.expectedDelivery && (
            <div className="ml-auto text-right">
              <div className="text-[11px] text-text-muted">Expected</div>
              <div className="text-[13px] font-semibold text-text-primary">
                {new Date(shipment.expectedDelivery + 'T00:00:00').toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tracking timeline */}
        <div>
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-2">
            Tracking History
          </div>
          {isLoading ? (
            <div className="text-[13px] text-text-muted py-2">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-[13px] text-text-muted py-2">No tracking events yet</div>
          ) : (
            <div className="space-y-0">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className="flex gap-3 py-2 border-b border-border last:border-b-0"
                >
                  <div className="flex flex-col items-center flex-shrink-0 w-[6px] mt-1">
                    <div className={`w-[6px] h-[6px] rounded-full ${i === 0 ? 'bg-grocery' : 'bg-[#d0ccc6]'}`} />
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 bg-[#e8e4de] mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text-primary">{event.description}</div>
                    <div className="text-[11px] text-text-muted mt-[2px]">
                      {event.location && <span>{event.location} · </span>}
                      {new Date(event.occurredAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(event.occurredAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/packages/PackageDetailModal.tsx
git commit -m "feat(packages): add PackageDetailModal with tracking timeline"
```

---

### Task 6: PackagesWidget and HomeBoard wiring

**Files:**
- Modify: `frontend/src/integrations/packages/PackagesWidget.tsx`
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Implement the full PackagesWidget**

Replace `frontend/src/integrations/packages/PackagesWidget.tsx`:
```typescript
import { useState } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { usePackages } from './usePackages'
import { ShipmentRow } from './ShipmentRow'
import { PackageDetailModal } from './PackageDetailModal'
import type { Shipment, ShipmentStatus } from './types'

const STATUS_ORDER: Record<ShipmentStatus, number> = {
  out_for_delivery: 0,
  in_transit: 1,
  shipped: 2,
  label_created: 3,
  exception: 4,
  unknown: 5,
  delivered: 6,
  returned: 7,
  cancelled: 8,
}

const HIDDEN_STATUSES: ShipmentStatus[] = ['cancelled', 'returned']

export function PackagesWidget() {
  const { data, isLoading, error } = usePackages()
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)

  const allShipments = data?.shipments ?? []

  // Filter out cancelled/returned, sort by status order
  const visible = allShipments
    .filter((s) => !HIDDEN_STATUSES.includes(s.status))

  const active = visible
    .filter((s) => s.status !== 'delivered')
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))

  const delivered = visible
    .filter((s) => s.status === 'delivered')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const shipments = [...active, ...delivered]
  const activeCount = active.length

  if (isLoading && shipments.length === 0) {
    return (
      <WidgetCard title="Packages" category="grocery">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error && shipments.length === 0) {
    return (
      <WidgetCard title="Packages" category="grocery">
        <div className="text-[13px] text-text-muted">Unable to load packages</div>
      </WidgetCard>
    )
  }

  return (
    <>
      <WidgetCard
        title="Packages"
        category="grocery"
        badge={activeCount > 0 ? `${activeCount} active` : undefined}
      >
        {shipments.length === 0 ? (
          <div className="text-[13px] text-text-muted py-1">No packages</div>
        ) : (
          <div className="flex flex-col">
            {active.map((shipment) => (
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                onClick={() => setSelectedShipment(shipment)}
              />
            ))}
            {delivered.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] pt-[6px] mt-[4px]">
                  Recently delivered
                </div>
                {delivered.map((shipment) => (
                  <ShipmentRow
                    key={shipment.id}
                    shipment={shipment}
                    onClick={() => setSelectedShipment(shipment)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </WidgetCard>
      <PackageDetailModal
        shipment={selectedShipment}
        onClose={() => setSelectedShipment(null)}
      />
    </>
  )
}
```

- [ ] **Step 2: Update HomeBoard grid layout**

In `frontend/src/boards/HomeBoard.tsx`:

Add import:
```typescript
import { PackagesWidget } from '@/integrations/packages'
```

Replace the chores section (currently col 2, spans rows 2-3):
```typescript
{/* Chores -- col 2, spans 2 rows */}
<div style={{ gridRow: '2 / 4', minHeight: 0 }} className="overflow-hidden">
  <ChoresWidget />
</div>
```

With packages in row 2 and chores in row 3:
```typescript
{/* Packages -- col 2, row 2 */}
<PackagesWidget />

{/* Chores -- col 2, row 3 */}
<div style={{ minHeight: 0 }} className="overflow-hidden">
  <ChoresWidget />
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/packages/PackagesWidget.tsx frontend/src/boards/HomeBoard.tsx
git commit -m "feat(packages): add PackagesWidget and wire into HomeBoard grid"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Run backend compile check**

Run: `cd backend && cargo check`

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Test the backend proxy**

Start the backend on an alternate port and test:
```bash
cd backend && PORT=3099 cargo run &
sleep 10
curl -s http://localhost:3099/api/packages/shipments
kill %1
```

Expected: JSON response from the packages service (or a clear error if the service isn't running).

- [ ] **Step 4: Visual verification**

Start the frontend dev server and verify:
- Packages widget appears in col 2, row 2
- Chores widget appears below it in col 2, row 3
- If packages service is running, shipments appear with icons and ETAs
- Tapping a shipment opens the modal with tracking events
- Settings page shows "Packages" with service URL config field

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat(packages): complete packages integration v1"
```
