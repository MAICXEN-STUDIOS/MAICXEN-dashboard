export const DEFAULT_CATALOG_PRODUCTS = [
  {
    product_id: "smarty",
    product_name: "Smarty",
    latest_version: "1.6.1",
    tagline: "23×5 Addressable RGB Matrix · Capacitive Touch · Hybrid USB/Cloud FOTA",
    accent: "#f59e0b",
    models: [
      {
        model_id: "esp32s3-std",
        model_name: "Smarty 23×5 RGB Matrix (ESP32-S3)",
        chip: "ESP32-S3",
        hw_rev: "1.0",
        latest_version: "1.6.1",
        version_url: "./firmware/smarty/esp32s3-std/version.json",
        firmware_url: "./firmware/smarty/esp32s3-std/firmware.bin",
        bootloader_url: "./firmware/smarty/esp32s3-std/bootloader.bin",
        partitions_url: "./firmware/smarty/esp32s3-std/partitions.bin",
        boot_app0_url: "./firmware/smarty/esp32s3-std/boot_app0.bin",
        capabilities: ["power", "brightness", "rgb", "effects", "usb_fota", "cloud_fota", "local_web", "alexa"],
        notes: "v1.6.1 — Enabled native ESP32-S3 USB-CDC (HWCDC) alongside UART0 for zero-reset Live USB Telemetry and WebSerial FOTA."
      }
    ]
  },
  {
    product_id: "aleda",
    product_name: "AledA",
    latest_version: "1.1.1",
    tagline: "Architectural 4-Relay, 4-Dimmer & 3-Strip Controller · Local Web UI · Matter / Voice Sync",
    accent: "#38bdf8",
    models: [
      {
        model_id: "esp32s3-std",
        model_name: "AledA Standard Controller (ESP32-S3)",
        chip: "ESP32-S3",
        hw_rev: "1.0",
        latest_version: "1.1.1",
        version_url: "./firmware/aleda/esp32s3-std/version.json",
        firmware_url: "./firmware/aleda/esp32s3-std/firmware.bin",
        bootloader_url: "./firmware/aleda/esp32s3-std/bootloader.bin",
        partitions_url: "./firmware/aleda/esp32s3-std/partitions.bin",
        boot_app0_url: "./firmware/aleda/esp32s3-std/boot_app0.bin",
        capabilities: ["power", "relays", "dimmers", "strips", "usb_fota", "cloud_fota", "local_web", "alexa"],
        notes: "v1.1.1 — Added 8KB USB-CDC RX queue, 20ms TX timeout & non-blocking serial parser for Live USB Telemetry and zero-reset WebSerial FOTA."
      },
      {
        model_id: "esp32s3-matter",
        model_name: "AledA Matter over Wi-Fi Controller (ESP32-S3)",
        chip: "ESP32-S3",
        hw_rev: "1.0",
        latest_version: "1.1.1",
        version_url: "./firmware/aleda/esp32s3-matter/version.json",
        firmware_url: "./firmware/aleda/esp32s3-matter/firmware.bin",
        bootloader_url: "./firmware/aleda/esp32s3-matter/bootloader.bin",
        partitions_url: "./firmware/aleda/esp32s3-matter/partitions.bin",
        boot_app0_url: "./firmware/aleda/esp32s3-matter/boot_app0.bin",
        capabilities: ["power", "relays", "dimmers", "strips", "matter", "usb_fota", "cloud_fota", "local_web"],
        notes: "v1.1.1 — Added 8KB USB-CDC RX queue, 20ms TX timeout & non-blocking serial parser for Live USB Telemetry and zero-reset WebSerial FOTA."
      }
    ]
  },
  {
    product_id: "onir",
    product_name: "onIR",
    latest_version: "1.0.0",
    tagline: "Universal Matter-over-WiFi IR Bridge · NVS ON/OFF Profiles · Live IR Learning · Dual-Core",
    accent: "#a855f7",
    models: [
      {
        model_id: "esp32-matter",
        model_name: "onIR Universal IR Bridge (ESP32 Matter)",
        chip: "ESP32",
        hw_rev: "1.0",
        offsets: [4096, 32768, 57344, 65536],
        latest_version: "1.0.0",
        version_url: "./firmware/onir/esp32-matter/version.json",
        firmware_url: "./firmware/onir/esp32-matter/firmware.bin",
        bootloader_url: "./firmware/onir/esp32-matter/bootloader.bin",
        partitions_url: "./firmware/onir/esp32-matter/partitions.bin",
        boot_app0_url: "./firmware/onir/esp32-matter/boot_app0.bin",
        capabilities: ["power", "ir_tx", "ir_rx", "ir_learn", "matter", "usb_fota", "cloud_fota", "local_web"],
        notes: "v1.0.0 — Initial MAICXEN EDGE release: Universal Matter IR Bridge with NVS ON/OFF IR profiles, live IR remote capture, dual-core FreeRTOS architecture, Local Web UI, Pre-Matter FOTA & USB-FOTA."
      }
    ]
  }
];

export async function fetchPublicCatalog(sbClient, catalogJsonUrl = "./catalog.json") {
  let fetchedProducts = [];

  if (sbClient) {
    const { data, error } = await sbClient
      .from("product_catalog")
      .select("*")
      .eq("is_public", true)
      .order("product_id", { ascending: true });

    if (!error && data && data.length > 0) {
      const grouped = {};
      data.forEach((row) => {
        if (!grouped[row.product_id]) {
          grouped[row.product_id] = {
            product_id: row.product_id,
            product_name: row.product_name,
            latest_version: row.latest_version,
            tagline: row.description || "",
            accent: row.product_id === "aleda" ? "#38bdf8" : row.product_id === "onir" ? "#a855f7" : "#f59e0b",
            models: []
          };
        }
        const prodVer = grouped[row.product_id].latest_version;
        const isClassicEsp32 = String(row.chip || "").toUpperCase() === "ESP32";
        grouped[row.product_id].models.push({
          model_id: row.model_id,
          model_name: row.model_name,
          chip: row.chip,
          hw_rev: row.hw_rev,
          offsets: isClassicEsp32 ? [4096, 32768, 57344, 65536] : [0, 32768, 69632, 131072],
          latest_version: prodVer,
          version_url: row.version_url || `./firmware/${row.product_id}/${row.model_id}/version.json`,
          firmware_url: row.firmware_url || `./firmware/${row.product_id}/${row.model_id}/firmware.bin`,
          bootloader_url: row.bootloader_url || `./firmware/${row.product_id}/${row.model_id}/bootloader.bin`,
          partitions_url: row.partitions_url || `./firmware/${row.product_id}/${row.model_id}/partitions.bin`,
          boot_app0_url: row.boot_app0_url || `./firmware/${row.product_id}/${row.model_id}/boot_app0.bin`,
          capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
          notes: row.release_notes || row.description || ""
        });
      });
      fetchedProducts = Object.values(grouped);
    }
  }

  if (fetchedProducts.length === 0) {
    const res = await fetch(`${catalogJsonUrl}?cb=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const cat = await res.json();
      if (cat.products && cat.products.length > 0) {
        fetchedProducts = cat.products;
      }
    }
  }

  return fetchedProducts;
}
