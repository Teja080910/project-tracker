import { redirect } from 'next/navigation';

/**
 * Projects are browsed through their team, so there is no standalone
 * projects index. Keep the old URL working by sending it to Teams.
 */
export default function ProjectsPage() {
  redirect('/app/teams');
}
