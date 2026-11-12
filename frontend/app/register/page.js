import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';
export const metadata = { title: 'Create account | JobRadar PK' };
export default function Register() { return <Suspense><AuthForm mode="register" /></Suspense>; }
