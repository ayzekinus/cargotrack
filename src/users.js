// ─────────────────────────────────────────────────────────────
//  CargoTrack — User Accounts
//  Edit this file to add, remove or change users and passwords.
//  Role options: "admin" | "operator" | "viewer"
// ─────────────────────────────────────────────────────────────

export const USERS = [
  {
    id: "u1",
    username: "admin",
    password: "cargotrack2024",
    name: "Administrator",
    role: "admin",
  },
  {
    id: "u2",
    username: "operator",
    password: "operator123",
    name: "Operator",
    role: "operator",
  },
  {
    id: "u3",
    username: "viewer",
    password: "viewer123",
    name: "Viewer",
    role: "viewer",
  },
];

// Session key used in localStorage
export const SESSION_KEY = "cargotrack_session";
