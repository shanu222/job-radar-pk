import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

// The front door: visitors sign in here (signed-in users are sent to their jobs by AuthGate)
export default function Home() {
  return <Suspense><AuthForm mode="login" /></Suspense>;
}
