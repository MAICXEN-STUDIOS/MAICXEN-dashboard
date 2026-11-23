# MAICXEN EDGE — IoT Fleet Dashboard

Real-time IoT device fleet console hosted at **`https://iot.maicxen.it/dashboard/`** (GitHub Pages `gh-pages` branch) and styled with the official **MAICXEN EDGE Cyber Mint (`#00ffc3`)** design system.

## Features
- **Invite-Only Supabase Auth & 5-Tier RBAC**: Shares credentials with `MAICXEN_console` on project `fuhuykcbapcdwtrwpccy` (`owner` > `admin` > `manager` > `editor` > `viewer`), with pre-authorized expiring email invites, copyable registration links (`?mode=signup&email=...`), and account suspension controls.
- **Live Fleet Telemetry**: Real-time Supabase Realtime sync for ESP32 / ESP32-S3 devices (`Smarty`, `AledA`, `onIR`), remote commands, FOTA triggers, and local LAN discovery.
- **Unified Design System**: Pure black (`#000000`) glassmorphic surfaces, `Satoshi` / `Inter` / `Plus Jakarta Sans` typography, and Cyber Mint (`#00ffc3`) accents matching `maicxen.it/edge` and `MAICXEN_console`.
