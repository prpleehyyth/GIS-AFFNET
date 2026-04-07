import { redirect } from 'next/navigation';

export default function Home() {
  // Kalau entah gimana lolos dari middleware, paksa arahin ke dashboard
  redirect('/dashboard');
}