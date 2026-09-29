import { tokenFromUrl } from "./lib/report";
import { Report } from "./modules/Report";
import { BackHomeLink } from "./modules/BackHomeLink";
import { Flow } from "./modules/citizen/Flow";

export function App() {
  const token = tokenFromUrl();
  if (!token) return <Flow />;
  return <Report token={token}><BackHomeLink /></Report>;
}
