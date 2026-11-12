import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';
export const metadata = { title: 'Sign in | JobRadar PK' };
export default function Login() { return <Suspense><AuthForm mode="login" /></Suspense>; }
