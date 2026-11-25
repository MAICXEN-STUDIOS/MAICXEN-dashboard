-- MAICXEN EDGE IoT Dashboard — Strict Read-Only RLS for Viewer (L1)
-- Devices ingest telemetry via SECURITY DEFINER RPC `public.device_ingest_telemetry`,
-- so restricting table INSERT/UPDATE to role_level >= 2 (editor/manager/admin/owner)
-- blocks direct browser/API writes by viewers without affecting IoT devices.

DROP POLICY IF EXISTS "Active users can insert discovered telemetry devices" ON public.smarty_devices;
CREATE POLICY "Editors and admins can insert discovered telemetry devices"
  ON public.smarty_devices
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.current_user_role_level()) >= 2);

DROP POLICY IF EXISTS "Active users can update telemetry state" ON public.smarty_devices;
CREATE POLICY "Editors and admins can update telemetry state"
  ON public.smarty_devices
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.current_user_role_level()) >= 2)
  WITH CHECK ((SELECT private.current_user_role_level()) >= 2);

DROP POLICY IF EXISTS "Active users can insert events" ON public.smarty_events;
CREATE POLICY "Editors and admins can insert events"
  ON public.smarty_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.current_user_role_level()) >= 2);
