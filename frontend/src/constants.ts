import type { ThemeColors } from "@/src/theme";

export type StatusKey =
  | "DRAFT" | "NEW" | "UNDER_CHECKING" | "CORRECTION_REQUIRED" | "APPROVED"
  | "PRODUCTION_PLANNING" | "IN_PRODUCTION" | "QC" | "READY_FOR_DISPATCH"
  | "DISPATCHED" | "BILLED" | "CLOSED";

type Meta = { label: string; bg: keyof ThemeColors; text: keyof ThemeColors };

export const STATUS_META: Record<string, Meta> = {
  DRAFT: { label: "Draft", bg: "status_draft_bg", text: "status_draft_text" },
  NEW: { label: "New", bg: "status_new_bg", text: "status_new_text" },
  UNDER_CHECKING: { label: "Under Checking", bg: "status_under_checking_bg", text: "status_under_checking_text" },
  CORRECTION_REQUIRED: { label: "Correction Required", bg: "status_correction_bg", text: "status_correction_text" },
  APPROVED: { label: "Approved", bg: "status_approved_bg", text: "status_approved_text" },
  PRODUCTION_PLANNING: { label: "Production Planning", bg: "status_in_production_bg", text: "status_in_production_text" },
  IN_PRODUCTION: { label: "In Production", bg: "status_in_production_bg", text: "status_in_production_text" },
  QC: { label: "QC", bg: "status_qc_bg", text: "status_qc_text" },
  READY_FOR_DISPATCH: { label: "Ready for Dispatch", bg: "status_ready_dispatch_bg", text: "status_ready_dispatch_text" },
  DISPATCHED: { label: "Dispatched", bg: "status_dispatched_bg", text: "status_dispatched_text" },
  BILLED: { label: "Billed", bg: "status_billed_bg", text: "status_billed_text" },
  CLOSED: { label: "Closed", bg: "status_closed_bg", text: "status_closed_text" },
};

export const PRIORITY_META: Record<string, Meta> = {
  Normal: { label: "Normal", bg: "priority_normal_bg", text: "priority_normal_text" },
  Urgent: { label: "Urgent", bg: "priority_urgent_bg", text: "priority_urgent_text" },
  "Very Urgent": { label: "Very Urgent", bg: "priority_very_urgent_bg", text: "priority_very_urgent_text" },
};

export const PERMISSION_LABELS: Record<string, string> = {
  create_edit_orders: "Create / edit orders",
  assign_responsibility: "Assign responsibility",
  check_approve_return: "Check / approve / return",
  update_production: "Update production",
  qc_updates: "QC updates",
  record_dispatch: "Record dispatch",
  record_billing: "Record billing",
  export_reports: "Export reports",
};

export const BOX_TYPES = [
  "Regular Corrugated Box", "Die-Cut Box", "4-Flap Box", "5-Panel Box",
  "Partition Box", "Printed Box", "Other",
];
export const PLY_OPTIONS = ["3 Ply", "5 Ply", "7 Ply"];
export const UNIT_OPTIONS = ["PCS", "SET", "OTHER"];
export const FLUTE_OPTIONS = ["A", "B", "C", "E", "Other"];
export const BOARD_COLOURS = ["Kraft", "White Top", "Duplex", "Other"];
export const SIZE_TYPES = ["Internal", "External"];
export const PRIORITIES = ["Normal", "Urgent", "Very Urgent"];
export const PRINT_PROCESS = ["Flexographic", "Offset", "Digital", "Other"];
export const PRINT_COLOURS = ["1", "2", "3", "4"];
export const PRINT_SIDES = ["Outside", "Inside", "Both"];
export const ARTWORK_APPROVAL = ["Yes", "No", "Approval Pending"];
export const CONVERSION_PROCESSES = [
  "Slotting", "Creasing", "Die Cutting", "Punching", "Stitching",
  "Gluing", "Folding", "Taping", "Lamination", "BOPP", "Other",
];
export const DIE_REQUIREMENTS = ["Existing Die", "New Die", "No Die"];
export const TRANSPORT_OPTIONS = ["Customer", "Print Pack", "Transporter", "Other"];
export const FOLLOWUP_METHODS = ["Call", "Email", "WhatsApp", "Meeting", "Internal"];
export const SEND_BACK_REASONS = [
  "Size Missing", "Paper Specification Missing", "Ply Missing", "Artwork Missing",
  "PO Missing", "Printing Details Missing", "Process Missing", "Delivery Date Missing", "Other",
];
export const DOC_CATEGORIES = [
  "PO Copy", "Customer Drawing", "Printing Artwork", "Previous Sample Photo",
  "Quality/Specification", "Other",
];

export const DECLARATIONS: { key: string; label: string }[] = [
  { key: "po_checked", label: "I have checked the PO" },
  { key: "size_ok", label: "Box size is correctly entered" },
  { key: "quantity_ok", label: "Quantity is correctly entered" },
  { key: "spec_ok", label: "Board/paper specification is correctly entered" },
  { key: "printing_ok", label: "Printing requirement is correctly entered" },
  { key: "processes_ok", label: "All required processes are mentioned" },
  { key: "artwork_attached", label: "Customer drawing/artwork attached where required" },
  { key: "delivery_confirmed", label: "Delivery date has been confirmed" },
  { key: "instructions_ok", label: "All special instructions have been entered" },
];

export const isInternal = (role?: string) => ["Admin", "Manager", "Employee"].includes(role || "");
